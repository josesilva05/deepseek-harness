/**
 * Reads what a running llama-server is serving from its `GET /props` endpoint.
 *
 * llama-server loads one GGUF when its process starts, so the model, the
 * per-slot context window, and the input modalities are facts of the running
 * process rather than of any configuration file. `/props` reports all three.
 *
 * @module dsh-llm-llamacpp/server
 */

import { attributionHeaders } from '@deepseek-ai/dsh-llm'

/** What one llama-server process serves, as reported by `GET /props`. */
export interface LlamaCppServerState {
  /** Model name shown to people: the GGUF file name without directory and `.gguf`. */
  modelName: string
  /** Absolute path of the loaded GGUF on the server host. */
  modelPath: string
  /** Tokens one slot holds (`--ctx-size` divided by `--parallel`). */
  contextWindow: number
  /** Whether the server was started with a vision projector (`--mmproj`). */
  vision: boolean
  /** Number of slots the server decodes concurrently (`--parallel`). */
  slots: number
}

/** Result of one probe: the served state, or why none could be read. */
export type LlamaCppProbe =
  | { kind: 'online'; state: LlamaCppServerState }
  | { kind: 'offline'; reason: string }

/** Keep the file name of a path written with either separator, minus `.gguf`. */
function displayName(modelPath: string): string {
  const file = modelPath.split(/[\\/]/).pop() ?? modelPath
  return file.replace(/\.gguf$/i, '')
}

/**
 * Validate one `/props` body. The body crosses a process boundary, so every
 * field this adapter depends on is checked here rather than trusted.
 * @param body - parsed JSON from `GET /props`.
 * @returns the served state, or the reason the body does not describe one.
 */
export function parseProps(body: unknown): LlamaCppProbe {
  if (typeof body !== 'object' || body === null) return { kind: 'offline', reason: '/props did not return a JSON object' }
  const props = body as {
    model_path?: unknown
    total_slots?: unknown
    modalities?: { vision?: unknown }
    default_generation_settings?: { n_ctx?: unknown }
  }
  const modelPath = props.model_path
  const contextWindow = props.default_generation_settings?.n_ctx
  // Router mode answers `/props` without a loaded model as path "none" and n_ctx 0.
  if (typeof modelPath !== 'string' || modelPath.length === 0 || modelPath === 'none') {
    return { kind: 'offline', reason: 'the server has no model loaded' }
  }
  if (typeof contextWindow !== 'number' || !Number.isSafeInteger(contextWindow) || contextWindow <= 0) {
    return { kind: 'offline', reason: '/props reports no positive default_generation_settings.n_ctx' }
  }
  const slots = typeof props.total_slots === 'number' && Number.isSafeInteger(props.total_slots) && props.total_slots > 0
    ? props.total_slots
    : 1
  return {
    kind: 'online',
    state: {
      modelName: displayName(modelPath),
      modelPath,
      contextWindow,
      vision: props.modalities?.vision === true,
      slots,
    },
  }
}

/**
 * Ask one llama-server what it serves. A server that is not running, not yet
 * listening, or still loading answers `offline` with the reason instead of
 * throwing, because a stopped server is an ordinary state for a local model.
 * @param baseURL - server origin, for example `http://127.0.0.1:8080`.
 * @param timeoutMs - upper bound for the whole request.
 * @param signal - caller cancellation.
 * @returns the served state or the offline reason.
 * @throws the caller's abort reason when `signal` aborts.
 */
export async function probeServer(baseURL: string, timeoutMs: number, signal?: AbortSignal): Promise<LlamaCppProbe> {
  const url = new URL('props', baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
  const composed = signal === undefined
    ? AbortSignal.timeout(timeoutMs)
    : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
  let response: Response
  try {
    response = await fetch(url, { signal: composed, headers: attributionHeaders() })
  } catch (error) {
    signal?.throwIfAborted()
    const reason = error instanceof Error ? error.message : String(error)
    return { kind: 'offline', reason: `no llama-server answered at ${url.href} (${reason})` }
  }
  // 503 is llama-server's answer while the model is still loading.
  if (!response.ok) return { kind: 'offline', reason: `${url.href} answered HTTP ${String(response.status)}` }
  let body: unknown
  try {
    body = await response.json()
  } catch (_malformedBody) {
    // A non-JSON body means something other than llama-server owns the port.
    return { kind: 'offline', reason: `${url.href} did not return JSON` }
  }
  return parseProps(body)
}
