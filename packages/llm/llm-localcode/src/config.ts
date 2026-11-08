/**
 * Plugin configuration for the localcode route.
 *
 * Only facts the running API cannot report live here: where it listens, how
 * long to wait for it, and the per-request output cap. The model and its
 * context window are read from the API, as from a llama-server.
 *
 * @module dsh-llm-localcode/config
 */

import z from '@deepseek-ai/schemastery'
import { RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'

/** How the localcode API starts; it ends the message of a request the API cannot take. */
export const LOCALCODE_START_HINT = 'start the localcode API (start-api.bat)'

/** Plugin configuration for the localcode route. */
export interface Config {
  /** Harness provider route this plugin registers. */
  route: string
  /** Name selectors show for the route. */
  displayName: string
  /** API origin without the `/v1` suffix; omission reads {@link Config.baseURLEnv}, then `http://127.0.0.1:8080`, where `start-api.bat` listens. */
  baseURL?: string
  /** Environment variable naming the API origin when `baseURL` is omitted; `start-api.bat --harness` sets it for the API it started. */
  baseURLEnv: string
  /** Upper bound for one `GET /props` probe. */
  probeTimeoutMs: number
  /**
   * Per-request output cap sent when a request names none; clamped to the served
   * context window. Compaction reserves this cap out of the window, so a cap
   * close to the window leaves compaction no message budget.
   */
  maxTokens: number
  /**
   * Maximum silence while one stream read is outstanding. A long prompt takes
   * minutes on this machine's engine, so this covers the longest prompt read.
   */
  streamIdleTimeoutMs: number
  /** Provider-owned model-request retry policy. */
  retryPolicy?: RetryPolicyConfig
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  route: z.string().min(1).default('localcode'),
  displayName: z.string().min(1).default('localcode'),
  baseURL: z.string().min(1),
  baseURLEnv: z.string().min(1).default('LOCALCODE_BASE_URL'),
  probeTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(5_000),
  maxTokens: z.number().step(1).min(1).default(8_192),
  streamIdleTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(1_800_000),
  retryPolicy: RetryPolicySchema,
})
