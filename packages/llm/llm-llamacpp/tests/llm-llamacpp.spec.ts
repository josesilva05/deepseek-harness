import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmError, MessageId } from '@deepseek-ai/dsh-llm'
import type { Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import { apply, Config, LlamaCppAdapter, LOADED_MODEL_ID, parseProps, probeServer, registerLlamaServerRoute } from '../src/index.ts'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { resolveConfig } from '../src/config.ts'

/** A launch environment holding only the given process variables. */
function envOf(values: Record<string, string> = {}) {
  return createLaunchEnvironmentSnapshot([{ source: 'process', values }])
}

interface FakeServer {
  url: string
  /** Replace what `/props` answers from now on. */
  props: (body: unknown, status?: number) => void
  /** Request bodies received on `/v1/chat/completions`. */
  completions: unknown[]
}

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
})

const TEXT_EVENTS = [
  '{"choices":[{"delta":{"role":"assistant","content":""},"index":0,"finish_reason":null}]}',
  '{"choices":[{"delta":{"content":"pronto"},"index":0,"finish_reason":null}]}',
  '{"choices":[{"delta":{},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1}}',
  '[DONE]',
]

function props(modelPath: string, nCtx: number, vision: boolean): unknown {
  return {
    model_path: modelPath,
    total_slots: 1,
    modalities: { vision, audio: false },
    default_generation_settings: { n_ctx: nCtx },
  }
}

/** A llama-server stand-in: `/props` plus a scripted chat-completions stream. */
async function fakeServer(initial: unknown): Promise<FakeServer> {
  let propsBody = initial
  let propsStatus = 200
  const completions: unknown[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
    request.on('end', () => {
      if (request.url === '/props') {
        response.writeHead(propsStatus, { 'content-type': 'application/json' })
        response.end(JSON.stringify(propsBody))
        return
      }
      completions.push(JSON.parse(body))
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of TEXT_EVENTS) response.write(`data: ${event}\n\n`)
      response.end()
    })
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    props: (next, status = 200) => { propsBody = next; propsStatus = status },
    completions,
  }
}

function adapterFor(baseURL: string, overrides: Partial<Config> = {}): LlamaCppAdapter {
  return new LlamaCppAdapter({
    config: resolveConfig(configOf({ baseURL, ...overrides }), envOf()),
    resolveAttachments: () => undefined,
  })
}

let messageCount = 0

function userMessage(text: string): Message {
  messageCount += 1
  return { id: MessageId(`m-${String(messageCount)}`), role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }
}

/** Schema-validate a partial config; omitted fields take their defaults. */
function configOf(input: Partial<Config>): Config {
  return Config(input as Config)
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** An address nothing listens on: bind, read the port, close. */
async function closedPort(): Promise<string> {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  await new Promise(resolve => server.close(resolve))
  if (address === null || typeof address === 'string') throw new Error('no port')
  return `http://127.0.0.1:${String(address.port)}`
}

describe('parseProps', () => {
  it('reads the served model, per-slot context, and vision', () => {
    expect(parseProps(props('C:\\models\\Qwen3.8-27B-UD-Q5_K_M.gguf', 131072, true))).toEqual({
      kind: 'online',
      state: {
        modelName: 'Qwen3.8-27B-UD-Q5_K_M',
        modelPath: 'C:\\models\\Qwen3.8-27B-UD-Q5_K_M.gguf',
        contextWindow: 131072,
        vision: true,
        slots: 1,
      },
    })
  })

  it('treats router mode without a loaded model as offline', () => {
    expect(parseProps(props('none', 0, false))).toEqual({ kind: 'offline', reason: 'the server has no model loaded' })
  })

  it('rejects bodies without a usable context window', () => {
    expect(parseProps(props('/m/a.gguf', 0, false)).kind).toBe('offline')
    expect(parseProps(null).kind).toBe('offline')
  })
})

describe('probeServer', () => {
  it('reports a stopped server as offline instead of throwing', async () => {
    const probe = await probeServer(await closedPort(), 2_000)
    expect(probe.kind).toBe('offline')
  })

  it('reports a loading server (HTTP 503) as offline', async () => {
    const server = await fakeServer({ error: 'loading' })
    server.props({ error: 'loading' }, 503)
    expect(await probeServer(server.url, 2_000)).toEqual({ kind: 'offline', reason: `${server.url}/props answered HTTP 503` })
  })
})

describe('LlamaCppAdapter', () => {
  it('describes the model the server has loaded', async () => {
    const server = await fakeServer(props('/models/Qwen3.8-27B-UD-Q5_K_M.gguf', 131072, true))
    const adapter = adapterFor(server.url)
    expect(await adapter.listModels('llamacpp')).toEqual([{
      provider: 'llamacpp',
      id: LOADED_MODEL_ID,
      name: 'Qwen3.8-27B-UD-Q5_K_M',
      description: `131072-token context at ${server.url}`,
      inputModalities: ['text', 'image'],
    }])
    const model = await adapter.resolveModel('llamacpp', LOADED_MODEL_ID)
    expect(model.context).toEqual({ contextWindow: 131072 })
    expect(model.defaultMaxTokens).toBe(32768)
  })

  it('follows a model switched on the server without reconfiguration', async () => {
    const server = await fakeServer(props('/models/a.gguf', 131072, true))
    const adapter = adapterFor(server.url)
    expect((await adapter.resolveModel('llamacpp', LOADED_MODEL_ID)).name).toBe('a')
    server.props(props('/models/b.gguf', 8192, false))
    const model = await adapter.resolveModel('llamacpp', LOADED_MODEL_ID)
    expect(model).toMatchObject({ name: 'b', context: { contextWindow: 8192 }, inputModalities: ['text'], defaultMaxTokens: 8192 })
  })

  it('streams through the OpenAI-compatible endpoint with the served capacities', async () => {
    const server = await fakeServer(props('/models/a.gguf', 16384, false))
    const adapter = adapterFor(server.url)
    const prepared = await adapter.prepareCall('llamacpp', LOADED_MODEL_ID)
    const chunks = await collect(prepared.stream({ provider: 'llamacpp', model: LOADED_MODEL_ID, messages: [userMessage('oi')] }))
    expect(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join('')).toBe('pronto')
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(server.completions).toHaveLength(1)
    expect(server.completions[0]).toMatchObject({ model: LOADED_MODEL_ID, stream: true })
  })

  it('keeps the route selectable but refuses requests while the server is offline', async () => {
    const url = await closedPort()
    const adapter = adapterFor(url)
    const models = await adapter.listModels('llamacpp')
    expect(models).toMatchObject([{ provider: 'llamacpp', id: LOADED_MODEL_ID, name: 'llama.cpp (offline)' }])
    expect(models[0]?.description).toContain(`no server answered at ${url}/props`)
    expect(await adapter.resolveModel('llamacpp', LOADED_MODEL_ID)).toEqual({
      provider: 'llamacpp', id: LOADED_MODEL_ID, name: 'llama.cpp (offline)',
    })
    await expect(adapter.prepareCall('llamacpp', LOADED_MODEL_ID)).rejects.toMatchObject({ code: 'SERVER_UNAVAILABLE' })
    await expect(adapter.prepareCall('llamacpp', LOADED_MODEL_ID)).rejects.toThrow(/^llama\.cpp: .*; start llama-server with a model at http/)
  })

  it('names the route and how its server starts when another server speaks the same API', async () => {
    const adapter = new LlamaCppAdapter({
      config: resolveConfig(configOf({ baseURL: await closedPort(), displayName: 'localcode' }), envOf()),
      startHint: 'run start-api.bat',
      resolveAttachments: () => undefined,
    })
    await expect(adapter.prepareCall('localcode', LOADED_MODEL_ID)).rejects.toThrow(/^localcode: .*; run start-api\.bat at http/)
    await expect(adapter.resolveModel('localcode', 'qwen')).rejects.toThrow(/^localcode route "localcode" serves only model "loaded"/)
  })

  it('refuses model ids other than the loaded model', async () => {
    const adapter = adapterFor('http://127.0.0.1:1')
    await expect(adapter.resolveModel('llamacpp', 'qwen')).rejects.toBeInstanceOf(LlmError)
  })
})

describe('route registration', () => {
  it('registers the configured route on ctx.llm', async () => {
    const server = await fakeServer(props('/models/a.gguf', 4096, false))
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf({ baseURL: server.url }))
    expect(await ctx.llm.listModels('llamacpp')).toMatchObject([{ id: LOADED_MODEL_ID, name: 'a' }])
  })

  it('registers another llama-server-compatible route under its own name and start hint', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    const url = await closedPort()
    registerLlamaServerRoute(ctx, resolveConfig(configOf({ baseURL: url, route: 'localcode', displayName: 'localcode' }), envOf()),
      'llm-localcode', 'run start-api.bat')
    expect(await ctx.llm.listModels('localcode')).toMatchObject([{ name: 'localcode (offline)' }])
  })
})

describe('resolveConfig', () => {
  it('normalizes the base URL and rejects non-http schemes', () => {
    expect(resolveConfig(configOf({ baseURL: 'http://127.0.0.1:8080/' }), envOf()).baseURL).toBe('http://127.0.0.1:8080')
    expect(() => resolveConfig(configOf({ baseURL: 'file:///tmp' }), envOf())).toThrow(/http or https/)
  })

  it('prefers the configured baseURL, then LLAMACPP_BASE_URL, then the llama-server default address', () => {
    const env = envOf({ LLAMACPP_BASE_URL: 'http://127.0.0.1:8081/' })
    expect(resolveConfig(configOf({ baseURL: 'http://10.0.0.5:9000' }), env).baseURL).toBe('http://10.0.0.5:9000')
    expect(resolveConfig(configOf({}), env).baseURL).toBe('http://127.0.0.1:8081')
    expect(resolveConfig(configOf({}), envOf()).baseURL).toBe('http://127.0.0.1:8080')
    expect(resolveConfig(configOf({ baseURLEnv: 'MY_SERVER' }), envOf({ MY_SERVER: 'http://host:1234' })).baseURL).toBe('http://host:1234')
    expect(() => resolveConfig(configOf({}), envOf({ LLAMACPP_BASE_URL: 'ftp://x' }))).toThrow(/LLAMACPP_BASE_URL "ftp:\/\/x" must use http or https/)
  })

  it('prefixes configuration errors with the plugin that resolves them', () => {
    expect(() => resolveConfig(configOf({ baseURL: 'not a url' }), envOf(), 'llm-localcode')).toThrow(/^llm-localcode: baseURL "not a url" is not a URL/)
  })
})
