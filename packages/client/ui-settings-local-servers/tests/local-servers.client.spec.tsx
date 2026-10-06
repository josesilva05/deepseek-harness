// @vitest-environment jsdom
/**
 * The local model servers card: the join that keeps the routes the Models page
 * has no row for, the store's refresh outcomes, the card's rendering, and the
 * plugin's footer registration on a real cordis Context with fake Remote faces.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { LlmConfigurableProvider, LlmProviderInfo, ModelCatalog } from '@deepseek-ai/dsh-api-remotes/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply, inject, localServers, LocalServersStore } from '../src/client/index.ts'
import type { LocalServersProps, LocalServersRemote, LocalServersView, RemoteRead } from '../src/client/index.ts'
import { LocalServers } from '../src/client/LocalServers.tsx'
import { en } from '../src/client/locales.ts'
import { apply as nodeApply } from '../src/index.ts'

afterEach(cleanup)

const ok = <T,>(value: T): RemoteRead<T> => ({ ok: true, value })

const providers: LlmProviderInfo[] = [{ id: 'deepseek', name: 'DeepSeek' }, { id: 'localcode', name: 'localcode' }]

const directory: LlmConfigurableProvider[] = [
  { provider: 'deepseek', displayName: 'DeepSeek', settingsNs: 'llm-deepseek', settingsPath: [] },
]

const catalog: ModelCatalog = {
  default: { provider: 'localcode', model: 'loaded' },
  routableProviders: ['deepseek', 'localcode'],
  groups: [
    { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'deepseek-v4', name: 'DeepSeek-V4' }] },
    { id: 'localcode', name: 'localcode', models: [{ id: 'loaded', name: 'Qwen3.8-Flash-Next', description: '32768-token context at http://127.0.0.1:8080' }] },
  ],
  failures: [],
}

function remoteOf(overrides: Partial<LocalServersRemote> = {}): LocalServersRemote {
  return {
    listProviders: () => Promise.resolve(ok(providers)),
    listConfigurableProviders: () => Promise.resolve(ok(directory)),
    modelCatalog: () => Promise.resolve(ok(catalog)),
    ...overrides,
  }
}

const t = (key: keyof typeof en) => en[key]

function propsFor(view: LocalServersView, refresh = vi.fn(() => Promise.resolve())): LocalServersProps {
  return {
    useServers: <S,>(select: (state: LocalServersView) => S) => select(view),
    refresh,
    t,
  }
}

describe('localServers', () => {
  it('keeps the live routes without a Models-page row, with their first catalog model', () => {
    expect(localServers(providers, directory, catalog)).toEqual([{
      provider: 'localcode', name: 'localcode', model: 'Qwen3.8-Flash-Next', detail: '32768-token context at http://127.0.0.1:8080',
    }])
  })

  it('leaves out a route the catalog lists no model for, and a model without a description has no detail', () => {
    const bare: ModelCatalog = { ...catalog, groups: [{ id: 'llamacpp', name: 'llama.cpp', models: [{ id: 'loaded', name: 'a' }] }] }
    const routes: LlmProviderInfo[] = [...providers, { id: 'llamacpp', name: 'llama.cpp' }]
    expect(localServers(routes, directory, bare)).toEqual([{ provider: 'llamacpp', name: 'llama.cpp', model: 'a' }])
  })
})

describe('LocalServersStore', () => {
  it('publishes the local routes after a refresh', async () => {
    const store = new LocalServersStore(remoteOf())
    expect(store.view.getSnapshot()).toEqual({ status: 'idle', servers: [] })
    await store.refresh()
    expect(store.view.getSnapshot()).toMatchObject({ status: 'ready', servers: [{ provider: 'localcode' }] })
  })

  it('keeps the last servers and reports the Host message when a read fails', async () => {
    let failing = false
    const store = new LocalServersStore(remoteOf({
      modelCatalog: () => Promise.resolve(failing ? { ok: false, error: { message: 'catalog down' } } : ok(catalog)),
    }))
    await store.refresh()
    failing = true
    await store.refresh()
    expect(store.view.getSnapshot()).toMatchObject({ status: 'error', error: 'catalog down', servers: [{ provider: 'localcode' }] })
  })

  it('drops a read a newer refresh overtook', async () => {
    let release: (() => void) | undefined
    const slow = new Promise<void>((resolve) => { release = resolve })
    let calls = 0
    const store = new LocalServersStore(remoteOf({
      listProviders: async () => {
        calls += 1
        if (calls === 1) {
          await slow
          return ok<LlmProviderInfo[]>([])
        }
        return ok(providers)
      },
    }))
    const first = store.refresh()
    await store.refresh()
    release?.()
    await first
    expect(store.view.getSnapshot()).toMatchObject({ status: 'ready', servers: [{ provider: 'localcode' }] })
  })
})

describe('LocalServers card', () => {
  it('shows each local route with its model and detail, and reads again on Refresh', () => {
    const refresh = vi.fn(() => Promise.resolve())
    render(<LocalServers {...propsFor({ status: 'ready', servers: localServers(providers, directory, catalog) }, refresh)} />)
    expect(screen.getByText('Local model servers')).toBeTruthy()
    expect(screen.getByText('Qwen3.8-Flash-Next')).toBeTruthy()
    expect(screen.getByText('32768-token context at http://127.0.0.1:8080')).toBeTruthy()
    expect(refresh).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('renders nothing once a read finds no local route', () => {
    const { container } = render(<LocalServers {...propsFor({ status: 'ready', servers: [] })} />)
    expect(container.innerHTML).toBe('')
  })

  it('says it is reading before the first answer and shows a failed read', () => {
    const { rerender } = render(<LocalServers {...propsFor({ status: 'loading', servers: [] })} />)
    expect(screen.getByText('Reading the local model servers…')).toBeTruthy()
    rerender(<LocalServers {...propsFor({ status: 'error', servers: [], error: 'offline' })} />)
    expect(screen.getByRole('alert').textContent).toBe('Could not read the local model servers: offline')
  })
})

describe('ui-settings-local-servers plugin', () => {
  it('keeps the host Loader entry inert', () => {
    expect(nodeApply).not.toThrow()
  })

  it('registers the card in the Models page footer with its copy namespace', async () => {
    const ctx = new Context()
    class RemoteService extends Service {
      constructor(serviceCtx: Context) {
        super(serviceCtx, 'remote')
      }
    }
    new RemoteService(ctx)
    const remote = remoteOf()
    ctx.provide('remote.llm', { listProviders: remote.listProviders, listConfigurableProviders: remote.listConfigurableProviders })
    ctx.provide('remote.session', { modelCatalog: remote.modelCatalog })
    ctx.provide('locale', new LocaleRuntime(ctx))
    await ctx.plugin(SlotRegistry).await()
    ctx.slots.register({
      name: 'root',
      children: { 'settings.models.footer': { kind: 'list', scope: 'root' } },
    } as never, () => null)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const [entry] = ctx.slots.entries('settings.models.footer')
    expect(entry?.options).toMatchObject({ id: 'local-servers', order: 10 })
    expect(entry?.locale).toBe('localServers')
    expect(entry?.inject).toBeTypeOf('function')
    await fiber.dispose()
    expect(ctx.slots.entries('settings.models.footer')).toHaveLength(0)
  })
})
