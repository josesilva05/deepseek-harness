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
 *     baseURL: http://127.0.0.1:8080  # omit to read LLAMACPP_BASE_URL
 * ```
 *
 * @module @deepseek-ai/dsh-llm-llamacpp
 */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { LlamaCppAdapter } from './adapter.ts'
import { Config, resolveConfig } from './config.ts'
import type { ResolvedConfig } from './config.ts'

export { LlamaCppAdapter, LOADED_MODEL_ID } from './adapter.ts'
export type { LlamaCppAdapterOptions } from './adapter.ts'
export { Config, LLAMA_SERVER_DEFAULT_ORIGIN, resolveConfig } from './config.ts'
export type { ResolvedConfig } from './config.ts'
export { parseProps, probeServer } from './server.ts'
export type { LlamaCppProbe, LlamaCppServerState } from './server.ts'

export const name = 'llm-llamacpp'
export const inject = ['llm']

/**
 * Register one route served by a llama-server-compatible API on `ctx.llm`:
 * this plugin's, and that of a plugin for another server speaking the same API.
 * @param ctx - plugin context carrying `ctx.llm`.
 * @param config - resolved route configuration.
 * @param plugin - plugin name that prefixes the replay warnings this route logs.
 * @param startHint - how the server starts, ending the message of a request the server cannot take (the adapter's `startHint` option).
 */
export function registerLlamaServerRoute(ctx: Context, config: ResolvedConfig, plugin: string, startHint?: string): void {
  const adapter = new LlamaCppAdapter({
    config,
    ...startHint === undefined ? {} : { startHint },
    resolveAttachments: () => ctx.get('attachments'),
    onReplayDegrade: ({ provider, model, reason }) => {
      ctx.logger.warn(`${plugin}: unusable replay state on "${provider}/${model}" history; sending provider-neutral content (${reason})`)
    },
  })
  ctx.llm.registerAdapter([config.route], adapter)
}

/**
 * Register the llama.cpp route on `ctx.llm`.
 * @param ctx - plugin context carrying `ctx.llm`.
 * @param config - schema-validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  registerLlamaServerRoute(ctx, resolveConfig(config, launchEnvironmentOf(ctx)), name)
}
