/**
 * LLM adapter for one running llama-server.
 *
 * The route serves exactly one model id, {@link LOADED_MODEL_ID}, whose
 * metadata is whatever the server has loaded at the moment of the call. Each
 * prepared call probes `GET /props` first, so a model switched on the server
 * reaches the next model step without a harness restart, and the context
 * window compaction plans against is the one the server actually allocated.
 *
 * Wire serialization is delegated to the pi-ai `openai-completions` client
 * through {@link PiAiAdapter}, built from a profile that describes the probed
 * state. A changed state builds a new profile map, and `PiAiAdapter` captures
 * one map per call, so a request finishes under the state it was prepared with.
 *
 * @module dsh-llm-llamacpp/adapter
 */

import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  PreparedAdapterCall,
  ResolvedRetryPolicy,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { createProvider, InMemoryCredentialStore } from '@earendil-works/pi-ai'
import type { Api, Model } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { PiAiAdapterOptions, ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedConfig } from './config.ts'
import { probeServer } from './server.ts'
import type { LlamaCppServerState } from './server.ts'

/**
 * The one model id this route serves. It names the role, not a file, so a
 * saved model selection stays valid when the server loads another GGUF.
 */
export const LOADED_MODEL_ID = 'loaded'

/**
 * Sent as the bearer token when no `apiKey` is configured. llama-server
 * without `--api-key` ignores the header; the client requires one.
 */
const PLACEHOLDER_API_KEY = 'llama.cpp'

/** Constructor options for {@link LlamaCppAdapter}. */
export interface LlamaCppAdapterOptions {
  /** Resolved plugin configuration. */
  config: ResolvedConfig
  /**
   * What to do about a server that does not answer, ending the `SERVER_UNAVAILABLE`
   * message before the address; default `start llama-server with a model`. Another
   * server speaking llama-server's API names how its own server starts.
   */
  startHint?: string
  /** Resolve the optional durable attachment service at request time. */
  resolveAttachments: NonNullable<PiAiAdapterOptions['resolveAttachments']>
  /** Observe history degraded to provider-neutral content. */
  onReplayDegrade?: PiAiAdapterOptions['onReplayDegrade']
}

/** The profile map built for one probed state, kept while the state is unchanged. */
interface StateProfiles {
  key: string
  profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile>
}

/** Adapter that serves whatever model one llama-server has loaded. */
export class LlamaCppAdapter extends LlmAdapter {
  private readonly inner: PiAiAdapter
  private current: StateProfiles | undefined

  constructor(private readonly options: LlamaCppAdapterOptions) {
    super()
    this.inner = new PiAiAdapter({
      profiles: () => {
        // Every caller probes before reaching the inner adapter.
        if (this.current === undefined) throw new LlmError('llama-server state was read before any probe', 'INTERNAL')
        return this.current.profiles
      },
      resolveApiKey: () => Promise.resolve(options.config.apiKey ?? PLACEHOLDER_API_KEY),
      // The request-level key override authenticates every call, so pi-ai's
      // stored-credential and ambient-discovery paths must find nothing.
      auth: {
        credentials: new InMemoryCredentialStore(),
        authContext: { env: () => Promise.resolve(undefined), fileExists: () => Promise.resolve(false) },
      },
      resolveAttachments: options.resolveAttachments,
      ...options.onReplayDegrade === undefined ? {} : { onReplayDegrade: options.onReplayDegrade },
    })
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: this.options.config.displayName }
  }

  override providerRetryPolicy(_provider: string): ResolvedRetryPolicy {
    return this.options.config.retryPolicy
  }

  /** The pi-ai profile describing one probed server state. */
  private profilesFor(state: LlamaCppServerState): ReadonlyMap<string, ResolvedPiAiProviderProfile> {
    const key = JSON.stringify(state)
    if (this.current?.key === key) return this.current.profiles
    const { config } = this.options
    const baseUrl = `${config.baseURL}/v1`
    const maxTokens = Math.min(config.maxTokens, state.contextWindow)
    const model: Model<Api> = {
      id: LOADED_MODEL_ID,
      name: state.modelName,
      api: 'openai-completions',
      provider: config.route,
      baseUrl,
      // Thinking is the chat template's default; no effort is selectable.
      reasoning: false,
      input: state.vision ? ['text', 'image'] : ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: state.contextWindow,
      maxTokens,
    }
    const profile: ResolvedPiAiProviderProfile = {
      provider: config.route,
      displayName: config.displayName,
      api: 'openai-completions',
      baseURL: baseUrl,
      streamIdleTimeoutMs: config.streamIdleTimeoutMs,
      maxRequestImageBytes: config.maxRequestImageBytes,
      requestImagePixelBudget: config.requestImagePixelBudget,
      requestImageMaxBytes: config.requestImageMaxBytes,
      retryPolicy: config.retryPolicy,
      configuredMaxTokens: new Map([[LOADED_MODEL_ID, maxTokens]]),
      // The one model is built from a validated probe, so it has no failure to report.
      modelErrors: new Map(),
      piProvider: createProvider({
        id: config.route,
        name: config.displayName,
        baseUrl,
        auth: {
          apiKey: {
            name: config.displayName,
            resolve: ({ credential }) => Promise.resolve({
              auth: credential?.key === undefined ? {} : { apiKey: credential.key },
              source: config.displayName,
            }),
          },
        },
        models: [model],
        api: openAICompletionsApi(),
      }),
    }
    const profiles = new Map([[config.route, profile]])
    this.current = { key, profiles }
    return profiles
  }

  /** Probe the server and publish its state, or report why it cannot serve. */
  private async online(signal?: AbortSignal): Promise<LlamaCppServerState | string> {
    const { config } = this.options
    const probe = await probeServer(config.baseURL, config.probeTimeoutMs, signal)
    if (probe.kind === 'offline') return probe.reason
    this.profilesFor(probe.state)
    return probe.state
  }

  /** Refuse any model id other than {@link LOADED_MODEL_ID}. */
  private assertModel(provider: string, model: string): void {
    if (model !== LOADED_MODEL_ID) {
      throw new LlmError(
        `${this.options.config.displayName} route "${provider}" serves only model "${LOADED_MODEL_ID}" (the model the server has loaded), not "${model}"`,
        'UNKNOWN_MODEL',
      )
    }
  }

  /** Probe for a request, failing with an actionable error when no model is served. */
  private async requireOnline(signal?: AbortSignal): Promise<void> {
    const state = await this.online(signal)
    if (typeof state === 'string') {
      const { config, startHint = 'start llama-server with a model' } = this.options
      throw new LlmError(`${config.displayName}: ${state}; ${startHint} at ${config.baseURL}`, 'SERVER_UNAVAILABLE')
    }
  }

  /**
   * The one model with what selectors show beside its name: the served context
   * window and the address, or why the server does not serve now.
   */
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const state = await this.online()
    const { config } = this.options
    if (typeof state === 'string') {
      return [{ provider, id: LOADED_MODEL_ID, name: `${config.displayName} (offline)`, description: state }]
    }
    return [{
      provider,
      id: LOADED_MODEL_ID,
      name: state.modelName,
      description: `${String(state.contextWindow)}-token context at ${config.baseURL}`,
      inputModalities: state.vision ? ['text', 'image'] : ['text'],
    }]
  }

  /**
   * Describe the served model. With the server offline the result carries no
   * context metadata instead of throwing: a throw here would remove the route
   * from every model selector until the next successful resolution.
   */
  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    this.assertModel(provider, model)
    const state = await this.online(signal)
    if (typeof state === 'string') {
      return { provider, id: model, name: `${this.options.config.displayName} (offline)` }
    }
    return this.inner.resolveModel(provider, model, signal)
  }

  override async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> {
    this.assertModel(provider, model)
    await this.requireOnline(signal)
    return this.inner.prepareCall(provider, model, signal)
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.assertModel(options.provider, options.model)
    await this.requireOnline(options.signal)
    yield * this.inner.stream(options)
  }
}
