/**
 * Plugin configuration for the llama.cpp route.
 *
 * Only facts the running server cannot report live here: where it listens,
 * how long to wait for it, and how the harness should treat its replies. The
 * model, its context window, and its modalities are read from the server.
 *
 * @module dsh-llm-llamacpp/config
 */

import z from '@deepseek-ai/schemastery'
import { resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { ResolvedRetryPolicy, RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import type { LaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'

/** llama-server's own default listen address, used when neither the config nor the environment names one. */
export const LLAMA_SERVER_DEFAULT_ORIGIN = 'http://127.0.0.1:8080'

/** Plugin configuration for one llama-server route. */
export interface Config {
  /** Harness provider route this plugin registers. */
  route: string
  /** Name selectors show for the route. */
  displayName: string
  /** Server origin without the `/v1` suffix; omission reads {@link Config.baseURLEnv}, then llama-server's default address. */
  baseURL?: string
  /** Environment variable naming the server origin when `baseURL` is omitted; a launcher sets it for the server it started. */
  baseURLEnv: string
  /**
   * Bearer token for a server started with `--api-key`. Omit it for a server
   * without one; the request then carries a fixed placeholder, because the
   * OpenAI-compatible client refuses to send an unauthenticated request.
   */
  apiKey?: string
  /** Upper bound for one `GET /props` probe. */
  probeTimeoutMs: number
  /** Per-request output cap sent when a request names none; clamped to the served context window. */
  maxTokens: number
  /**
   * Maximum silence while one stream read is outstanding. llama-server sends
   * nothing while it evaluates the prompt, so this must cover the longest
   * prompt evaluation the deployment expects.
   */
  streamIdleTimeoutMs: number
  /** Maximum base64 image payload per request; the oldest images beyond it become text placeholders. */
  maxRequestImageBytes: number
  /** Total-pixel budget each inline image is downscaled to. */
  requestImagePixelBudget: number
  /** Raw encoded-byte cap for each inline image. */
  requestImageMaxBytes: number
  /** Provider-owned model-request retry policy. */
  retryPolicy?: RetryPolicyConfig
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  route: z.string().min(1).default('llamacpp'),
  displayName: z.string().min(1).default('llama.cpp'),
  baseURL: z.string().min(1),
  baseURLEnv: z.string().min(1).default('LLAMACPP_BASE_URL'),
  apiKey: z.string().role('secret'),
  probeTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(5_000),
  maxTokens: z.number().step(1).min(1).default(32_768),
  streamIdleTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(1_800_000),
  maxRequestImageBytes: z.number().step(1).min(1).default(20 * 1024 * 1024),
  requestImagePixelBudget: z.number().step(1).min(1).default(2048 * 2048),
  requestImageMaxBytes: z.number().step(1).min(1).default(1024 * 1024),
  retryPolicy: RetryPolicySchema,
})

/** {@link Config} after validation, with the retry policy resolved once. */
export interface ResolvedConfig extends Omit<Config, 'retryPolicy' | 'baseURL'> {
  /** Server origin, normalized to end without `/`. */
  baseURL: string
  /** Immutable retry policy captured with the route registration. */
  retryPolicy: ResolvedRetryPolicy
}

/**
 * Resolve the server origin and validate the parts of {@link Config} the schema cannot express.
 * The origin is the configured `baseURL`, else the `baseURLEnv` variable from the launch environment,
 * else llama-server's default address.
 * @param config - schema-validated plugin configuration.
 * @param environment - the launch environment snapshot the variable is read from.
 * @param plugin - plugin name that prefixes configuration errors; another plugin serving a llama-server-compatible route passes its own.
 * @returns the resolved configuration.
 * @throws Error naming the source when the origin is not an http(s) URL.
 */
export function resolveConfig(config: Config, environment: LaunchEnvironmentSnapshot, plugin = 'llm-llamacpp'): ResolvedConfig {
  const fromEnv = config.baseURL === undefined ? environment.get(config.baseURLEnv)?.value : undefined
  const origin = config.baseURL ?? (fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : LLAMA_SERVER_DEFAULT_ORIGIN)
  const source = config.baseURL !== undefined ? 'baseURL' : fromEnv ? config.baseURLEnv : 'default'
  let url: URL
  try {
    url = new URL(origin)
  } catch (cause) {
    throw new Error(`${plugin}: ${source} "${origin}" is not a URL`, { cause })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${plugin}: ${source} "${origin}" must use http or https`)
  }
  const { retryPolicy, baseURL: _baseURL, ...rest } = config
  return {
    ...rest,
    baseURL: url.href.replace(/\/+$/, ''),
    retryPolicy: resolveRetryPolicy(retryPolicy, `${plugin}: retryPolicy`),
  }
}
