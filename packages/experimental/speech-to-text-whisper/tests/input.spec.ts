/** Whisper accepts Portuguese first and rejects hints the native model cannot take before inference. */
import { expect, it } from 'vitest'
import { languages, SpeechInputError, validateInput } from '../src/input.ts'

function wave(seconds: number): Uint8Array {
  const data = Math.round(seconds * 16000) * 2
  const bytes = Buffer.alloc(44 + data)
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + data, 4); bytes.write('WAVE', 8)
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(data, 40)
  return new Uint8Array(bytes)
}

it('offers Portuguese first, then English and automatic detection', () => {
  expect(languages).toEqual(['pt', 'en', 'auto'])
})

it('accepts a canonical recording in every offered language and reports its duration', () => {
  for (const language of languages) expect(validateInput(wave(1.5), language, 4 * 1024 * 1024)).toBeCloseTo(1.5)
})

it('rejects regional tags and oversized or non-canonical audio before native inference', () => {
  expect(() => validateInput(wave(1), 'pt-BR', 4 * 1024 * 1024)).toThrow(SpeechInputError)
  expect(() => validateInput(wave(1), 'pt', 100)).toThrow('Speech audio exceeds the worker byte limit')
  expect(() => validateInput(new Uint8Array(60), 'pt', 4 * 1024 * 1024)).toThrow('Invalid speech WAV')
})
