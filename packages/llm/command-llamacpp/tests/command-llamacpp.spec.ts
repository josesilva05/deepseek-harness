import { describe, expect, it } from 'vitest'
import { renderModel } from '../src/index.ts'

describe('renderModel', () => {
  it('shows the served model, context window, output cap, and image support', () => {
    expect(renderModel('llamacpp', {
      provider: 'llamacpp',
      id: 'loaded',
      name: 'Qwen3.8-27B-UD-Q5_K_M',
      inputModalities: ['text', 'image'],
      context: { contextWindow: 131072 },
      defaultMaxTokens: 32768,
    })).toEqual({
      kind: 'success',
      text: [
        'llamacpp: Qwen3.8-27B-UD-Q5_K_M',
        'Context window: 131,072 tokens',
        'Output cap: 32,768 tokens',
        'Images: yes',
        'Select it as llamacpp/loaded.',
      ].join('\n'),
    })
  })

  it('reports an offline route as an error', () => {
    expect(renderModel('llamacpp', { provider: 'llamacpp', id: 'loaded', name: 'llama.cpp (offline)' })).toMatchObject({ kind: 'error' })
  })
})
