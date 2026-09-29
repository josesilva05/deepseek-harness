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
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'

/** Plugin configuration for one llama-server route. */
export interface Config {
  /** Harness provider route this plugin registers. */
  route: string
  /** Name selectors show for the route. */
  displayName: string
  /** Server origin without the `/v1` suffix. */
  baseURL: string
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
  baseURL: z.string().min(1).default('http://127.0.0.1:8080'),
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
export interface ResolvedConfig extends Omit<Config, 'retryPolicy'> {
  /** Server origin, normalized to end without `/`. */
  baseURL: string
  /** Immutable retry policy captured with the route registration. */
  retryPolicy: ResolvedRetryPolicy
}

/**
 * Validate the parts of {@link Config} the schema cannot express.
 * @param config - schema-validated plugin configuration.
 * @returns the resolved configuration.
 * @throws Error naming the field when `baseURL` is not an http(s) URL.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  let url: URL
  try {
    url = new URL(config.baseURL)
  } catch (cause) {
    throw new Error(`llm-llamacpp: baseURL "${config.baseURL}" is not a URL`, { cause })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`llm-llamacpp: baseURL "${config.baseURL}" must use http or https`)
  }
  const { retryPolicy, ...rest } = config
  return {
    ...rest,
    baseURL: url.href.replace(/\/+$/, ''),
    retryPolicy: resolveRetryPolicy(retryPolicy, 'llm-llamacpp: retryPolicy'),
  }
}
