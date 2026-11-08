/**
 * The injected face of this package's `settings.models.footer` entry. The slot
 * is declared and typed by ui-settings-models; this package only contributes
 * an entry, so no SlotMap merge lives here.
 * @module @deepseek-ai/dsh-client-ui-settings-local-servers/client/slots
 */

import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'localServers' seat).
import type {} from './locales.ts'
import type { LocalServersView } from './store.ts'

/** Injected business face of the local model servers card. */
export interface LocalServersInjected {
  hooks: {
    /** The card's state. */
    servers: HostObservable<LocalServersView>
  }
  /** Read the local routes again. */
  refresh: () => Promise<void>
}

/** Full props of the local model servers card. */
export type LocalServersProps = InjectFace<LocalServersInjected> & PropsLocale<'localServers'>
