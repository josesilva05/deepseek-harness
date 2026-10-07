/**
 * Local model servers store: the provider routes a plugin registers without a
 * Models-page row (a route served from a server on this machine, such as
 * `localcode` or `llamacpp`), each with the first model the catalog lists for it.
 * The Host stays the fact source: every refresh reads the provider list, the
 * configurable directory, and the model catalog again.
 * @module @deepseek-ai/dsh-client-ui-settings-local-servers/client/store
 */

import type { LlmConfigurableProvider, LlmProviderInfo, ModelCatalog } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

/** One Remote answer: the value, or the Host's error message. */
export type RemoteRead<T> = { ok: true; value: T } | { ok: false; error: { message: string } }

/** The three Remote reads the view joins. */
export interface LocalServersRemote {
  /** Live provider routes in registration order (`llm/listProviders`). */
  listProviders: () => Promise<RemoteRead<readonly LlmProviderInfo[]>>
  /** Providers with a Models-page settings row (`llm/listConfigurableProviders`). */
  listConfigurableProviders: () => Promise<RemoteRead<readonly LlmConfigurableProvider[]>>
  /** Every routable model grouped by provider (`session/modelCatalog`). */
  modelCatalog: () => Promise<RemoteRead<ModelCatalog>>
}

/** One provider route served from a local server, as the card shows it. */
export interface LocalServer {
  /** Provider route id. */
  readonly provider: string
  /** Route name selectors show. */
  readonly name: string
  /** Name of the model the server has loaded, or the route's offline label. */
  readonly model: string
  /** What the adapter adds beside the model: the context window and address, or why the server does not serve. */
  readonly detail?: string
}

/** The card's state. */
export interface LocalServersView {
  /** `idle` before the first read, `loading` during one, then `ready` or `error`. */
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  /** Local routes from the last successful read. */
  readonly servers: readonly LocalServer[]
  /** The Host's message for a failed read. */
  readonly error?: string
}

/**
 * Keep the live routes the Models page has no row for, each with its first catalog model.
 * @param registered - live provider routes in registration order.
 * @param configurable - providers with a Models-page settings row.
 * @param catalog - routable models grouped by provider.
 * @returns the local routes in registration order; a route without catalog models is left out.
 */
export function localServers(
  registered: readonly LlmProviderInfo[],
  configurable: readonly LlmConfigurableProvider[],
  catalog: ModelCatalog,
): LocalServer[] {
  const rowed = new Set(configurable.map(entry => entry.provider))
  return registered.filter(provider => !rowed.has(provider.id)).flatMap((provider) => {
    const model = catalog.groups.find(group => group.id === provider.id)?.models[0]
    if (model === undefined) return []
    return [{
      provider: provider.id,
      name: provider.name,
      model: model.name,
      ...model.description === undefined ? {} : { detail: model.description },
    }]
  })
}

/** Reads the local routes on demand and publishes them as one snapshot. */
export class LocalServersStore {
  /** The card's snapshot. */
  readonly view: SnapshotStore<LocalServersView> = createSnapshotStore<LocalServersView>({ status: 'idle', servers: [] })
  private generation = 0

  /**
   * @param remote - the Remote reads the view joins.
   */
  constructor(private readonly remote: LocalServersRemote) {}

  /**
   * Read the routes again. A read that a newer one overtook is dropped; a failed
   * read keeps the last servers and reports the Host's message.
   * @returns nothing; the snapshot carries the outcome.
   */
  async refresh(): Promise<void> {
    const generation = ++this.generation
    this.view.set({ ...this.view.getSnapshot(), status: 'loading' })
    const [registered, configurable, catalog] = await Promise.all([
      this.remote.listProviders(),
      this.remote.listConfigurableProviders(),
      this.remote.modelCatalog(),
    ])
    if (generation !== this.generation) return
    if (!registered.ok || !configurable.ok || !catalog.ok) {
      const [message = ''] = [registered, configurable, catalog].flatMap(read => read.ok ? [] : [read.error.message])
      this.view.set({ ...this.view.getSnapshot(), status: 'error', error: message })
      return
    }
    this.view.set({ status: 'ready', servers: localServers(registered.value, configurable.value, catalog.value) })
  }
}
