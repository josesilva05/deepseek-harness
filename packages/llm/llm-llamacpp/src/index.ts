/**
 * LLM adapter plugin for a llama.cpp `llama-server` running on this machine
 * or reachable over the network.
 *
 * The plugin registers one provider route (default `llamacpp`) serving one
 * model id, `loaded`. Which GGUF that is, its per-slot context window, and
 * whether it accepts images are read from the server's `GET /props` before
 * every model step, so starting, stopping, or switching the server's model
 * needs no harness configuration change.
 *
 * ```yaml
 * - id: llm-llamacpp
 *   name: '@deepseek-ai/dsh-llm-llamacpp'
 *   config:
 *     baseURL: http://127.0.0.1:8080
 * ```
 *
 * @module @deepseek-ai/dsh-llm-llamacpp
 */

import type { Context } from '@deepseek-ai/cordis'
import { LlamaCppAdapter } from './adapter.ts'
import { Config, resolveConfig } from './config.ts'

export { LlamaCppAdapter, LOADED_MODEL_ID } from './adapter.ts'
export type { LlamaCppAdapterOptions } from './adapter.ts'
export { Config } from './config.ts'
export type { ResolvedConfig } from './config.ts'
export { parseProps, probeServer } from './server.ts'
export type { LlamaCppProbe, LlamaCppServerState } from './server.ts'

export const name = 'llm-llamacpp'
export const inject = ['llm']

/**
 * Register the llama.cpp route on `ctx.llm`.
 * @param ctx - plugin context carrying `ctx.llm`.
 * @param config - schema-validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const adapter = new LlamaCppAdapter({
    config: resolved,
    resolveAttachments: () => ctx.get('attachments'),
    onReplayDegrade: ({ provider, model, reason }) => {
      ctx.logger.warn(`llm-llamacpp: unusable replay state on "${provider}/${model}" history; sending provider-neutral content (${reason})`)
    },
  })
  ctx.llm.registerAdapter([resolved.route], adapter)
}
