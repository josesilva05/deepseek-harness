import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { LOADED_MODEL_ID } from '@deepseek-ai/dsh-llm-llamacpp'
import { apply, Config, inject, name } from '../src/index.ts'

const servers: Server[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
})

/** The localcode API's `/props` as `q38_server.py` answers it. */
async function fakeApi(nCtx: number): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      model_path: 'C:\\models\\Qwen3.8-Flash-Next-UD-Q4_K_XL-00001-of-00004.gguf',
      total_slots: 1,
      modalities: { vision: false },
      default_generation_settings: { n_ctx: nCtx },
    }))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  return `http://127.0.0.1:${String(address.port)}`
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

/** Schema-validate a partial config; omitted fields take their defaults. */
function configOf(input: Partial<Config>): Config {
  return Config(input as Config)
}

async function contextWith(config: Config): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  apply(ctx, config)
  return ctx
}

describe('llm-localcode', () => {
  it('names itself and needs only the LLM service', () => {
    expect(name).toBe('llm-localcode')
    expect(inject).toEqual(['llm'])
  })

  it('defaults to the localcode route, its address variable, and an output cap that leaves compaction a budget', () => {
    expect(configOf({})).toMatchObject({ route: 'localcode', displayName: 'localcode', baseURLEnv: 'LOCALCODE_BASE_URL', maxTokens: 8192 })
  })

  it('serves the model the engine has open under the localcode route', async () => {
    const url = await fakeApi(32768)
    const ctx = await contextWith(configOf({ baseURL: url }))
    expect(await ctx.llm.listModels('localcode')).toMatchObject([{
      id: LOADED_MODEL_ID,
      name: 'Qwen3.8-Flash-Next-UD-Q4_K_XL-00001-of-00004',
      description: `32768-token context at ${url}`,
    }])
  })

  it('finds the API through LOCALCODE_BASE_URL', async () => {
    const url = await fakeApi(16384)
    vi.stubEnv('LOCALCODE_BASE_URL', url)
    const ctx = await contextWith(configOf({}))
    expect(await ctx.llm.listModels('localcode')).toMatchObject([{ description: `16384-token context at ${url}` }])
  })

  it('says how to start the API when a request finds it stopped', async () => {
    const ctx = await contextWith(configOf({ baseURL: await closedPort() }))
    expect(await ctx.llm.listModels('localcode')).toMatchObject([{ name: 'localcode (offline)' }])
    await expect(ctx.llm.prepareCall({ provider: 'localcode', model: LOADED_MODEL_ID })).rejects.toThrow(
      /^localcode: .*; start the localcode API \(start-api\.bat\) at http:\/\/127\.0\.0\.1:/,
    )
  })

  it('names itself in configuration errors', async () => {
    await expect(contextWith(configOf({ baseURL: 'ftp://host' }))).rejects.toThrow(/^llm-localcode: baseURL "ftp:\/\/host" must use http or https/)
  })
})
