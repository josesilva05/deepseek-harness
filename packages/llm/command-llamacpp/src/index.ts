/**
 * Human-facing `/llamacpp` command: shows which model a llama.cpp provider
 * route serves right now, its context window, and whether it accepts images.
 *
 * The command is a Consumer of the `ctx.llm` seam only. It reads the route's
 * advertised models and their exact metadata, so it works with any adapter
 * that registers the configured route and never sends anything to the model.
 *
 * ```yaml
 * - id: command-llamacpp
 *   name: '@deepseek-ai/dsh-command-llamacpp'
 *   config:
 *     route: llamacpp
 * ```
 *
 * @module @deepseek-ai/dsh-command-llamacpp
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'

export const name = 'command-llamacpp'
export const inject = ['commands', 'llm']

/** Plugin configuration. */
export interface Config {
  /** Provider route the command describes. */
  route: string
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  route: z.string().min(1).default('llamacpp'),
})

/**
 * Render one exact model description for the command output.
 * @param route - the described provider route.
 * @param model - exact metadata resolved through `ctx.llm`.
 * @returns the command result shown to the person.
 */
export function renderModel(route: string, model: LlmResolvedModelInfo): CommandResult {
  const contextWindow = model.context?.contextWindow
  // The adapter reports no context window exactly when the server is not serving.
  if (contextWindow === undefined) {
    return { kind: 'error', text: `${route}: ${model.name} — no model is being served; start llama-server and run /llamacpp again.` }
  }
  const images = model.inputModalities?.includes('image') === true ? 'yes' : 'no'
  return {
    kind: 'success',
    text: [
      `${route}: ${model.name}`,
      `Context window: ${contextWindow.toLocaleString('en-US')} tokens`,
      ...model.defaultMaxTokens === undefined ? [] : [`Output cap: ${model.defaultMaxTokens.toLocaleString('en-US')} tokens`],
      `Images: ${images}`,
      `Select it as ${route}/${model.id}.`,
    ].join('\n'),
  }
}

/**
 * Register `/llamacpp`.
 * @param ctx - plugin context carrying `ctx.commands` and `ctx.llm`.
 * @param config - schema-validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.commands.register({
    name: 'llamacpp',
    description: 'show the model the local llama.cpp server is serving',
    handler: async (): Promise<CommandResult> => {
      const route = config.route
      if (!ctx.llm.listProviders().some(provider => provider.id === route)) {
        return { kind: 'error', text: `No LLM provider route "${route}" is registered; install @deepseek-ai/dsh-llm-llamacpp.` }
      }
      const [first] = await ctx.llm.listModels(route)
      if (first === undefined) return { kind: 'error', text: `${route} advertises no model.` }
      return renderModel(route, await ctx.llm.resolveModelInfo(route, first.id))
    },
  })
}
