/**
 * LLM adapter plugin for the localcode API: this machine's own inference
 * engine, started by `start-api.bat` of qwen3.8-flash-next-in-c.
 *
 * The API answers llama-server's `GET /props` and OpenAI's
 * `POST /v1/chat/completions`, so the route runs on the llama-server client of
 * `dsh-llm-llamacpp` under its own name: provider `localcode`, one model id,
 * `loaded`, the model the engine has open. No llama.cpp code runs.
 *
 * ```yaml
 * - id: llm-localcode
 *   name: '@deepseek-ai/dsh-llm-localcode'
 *   config:
 *     baseURL: http://127.0.0.1:8080  # omit to read LOCALCODE_BASE_URL
 * ```
 *
 * @module @deepseek-ai/dsh-llm-localcode
 */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { Config as LlamaServerConfig, registerLlamaServerRoute, resolveConfig } from '@deepseek-ai/dsh-llm-llamacpp'
import { Config, LOCALCODE_START_HINT } from './config.ts'

export { Config, LOCALCODE_START_HINT } from './config.ts'

export const name = 'llm-localcode'
export const inject = ['llm']

/**
 * Register the localcode route on `ctx.llm`.
 * @param ctx - plugin context carrying `ctx.llm`.
 * @param config - schema-validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  // The llama-server schema fills the fields this route leaves at their defaults: no API key and the image limits.
  const route = LlamaServerConfig(config as LlamaServerConfig)
  registerLlamaServerRoute(ctx, resolveConfig(route, launchEnvironmentOf(ctx), name), name, LOCALCODE_START_HINT)
}
