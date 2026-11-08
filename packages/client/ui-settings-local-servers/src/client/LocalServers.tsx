/**
 * The Models page card listing model servers on this machine: per route, its
 * name, the model the server has loaded, and what the adapter reports beside it.
 * @module @deepseek-ai/dsh-client-ui-settings-local-servers/client/LocalServers
 */
import { useEffect } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LocalServersProps } from './slots.ts'
import css from './LocalServers.module.css'

/**
 * The local model servers card. It reads the routes when it mounts and on
 * Refresh, and renders nothing once a read finds no local route.
 * @param props - the card's state hook, the refresh verb, and the copy.
 * @returns the card, or nothing without local routes.
 */
export function LocalServers({ useServers, refresh, t }: LocalServersProps) {
  const view = useServers(state => state)
  useEffect(() => { void refresh() }, [refresh])
  if (view.status === 'ready' && view.servers.length === 0) return null
  return (
    <section className={css.section} aria-label={t('title')}>
      <div className={css.header}>
        <h3 className={css.title}>{t('title')}</h3>
        <Button variant="outline" size="sm" disabled={view.status === 'loading'} onClick={() => { void refresh() }}>
          {t('refresh')}
        </Button>
      </div>
      <p className={css.intro}>{t('intro')}</p>
      {view.status === 'error' && <p className={css.error} role="alert">{t('error').replace('{message}', view.error ?? '')}</p>}
      {view.servers.length === 0 && view.status !== 'error' && <p className={css.intro}>{t('loading')}</p>}
      {view.servers.length > 0 && (
        <ul className={css.rows}>
          {view.servers.map(server => (
            <li key={server.provider} className={css.card}>
              <span className={css.name}>{server.name}</span>
              <span className={css.model}>{server.model}</span>
              {server.detail !== undefined && <span className={css.detail}>{server.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
