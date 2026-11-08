/**
 * Local model servers card, browser half: one entry in the Models settings
 * footer (`settings.models.footer`) listing each provider route served from a
 * server on this machine, with the model it has loaded.
 * @module @deepseek-ai/dsh-client-ui-settings-local-servers/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the generated Remote API and ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Models page SlotMap merge (the footer seat).
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { LocalServers } from './LocalServers.tsx'
import type { LocalServersInjected } from './slots.ts'
import { LocalServersStore } from './store.ts'
import { en, zh } from './locales.ts'

export { localServers, LocalServersStore } from './store.ts'
export type { LocalServer, LocalServersRemote, LocalServersView, RemoteRead } from './store.ts'
export type { LocalServersInjected, LocalServersProps } from './slots.ts'
export type { LocalServersKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'localServers'

/** Required services: the slot registry, the two Remote namespaces the card reads, and the copy. */
export const inject = ['slots', 'locale', 'remote', 'remote.llm', 'remote.session']

/**
 * Register the card in the Models page footer once that seat is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-local-servers: dictionaries')
  const store = new LocalServersStore({
    listProviders: () => ctx.remote.llm.listProviders(),
    listConfigurableProviders: () => ctx.remote.llm.listConfigurableProviders(),
    modelCatalog: () => ctx.remote.session.modelCatalog(),
  })
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer',
    id: 'local-servers',
    order: 10,
    locale: NS,
    inject: (): LocalServersInjected => ({ hooks: { servers: store.view }, refresh: () => store.refresh() }),
  }, LocalServers))
}
