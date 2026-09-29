# @deepseek-ai/dsh-llm-llamacpp

English | [中文](README.zh.md)

LLM adapter for a running llama.cpp `llama-server`. The plugin registers one provider route (default `llamacpp`) that serves one model id, `loaded`: whatever GGUF the server has loaded when the call is made. The model name, the per-slot context window, and image support are read from the server's `GET /props` before every model step, so starting, stopping, or switching the server's model needs no harness configuration change and compaction plans against the context the server actually allocated.

## Install

The package declares `dsh.bundle`, so it is an installable Profile layer:

```sh
dsh plugin --profile web add ./packages/llm/llm-llamacpp
```

Select `llamacpp/loaded` as the model. Pair it with [`dsh-command-llamacpp`](../command-llamacpp/README.md) for the `/llamacpp` status command.

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `route` | `llamacpp` | Provider route this plugin registers. |
| `displayName` | `llama.cpp` | Route name shown by selectors. |
| `baseURL` | `http://127.0.0.1:8080` | Server origin without `/v1`; http or https. |
| `apiKey` | — | Bearer token for a server started with `--api-key`; without it a fixed placeholder is sent. |
| `probeTimeoutMs` | `5000` | Upper bound for one `GET /props` probe. |
| `maxTokens` | `32768` | Output cap for a request that names none; clamped to the served context window. |
| `streamIdleTimeoutMs` | `1800000` | Maximum silence while a stream read is outstanding. llama-server sends nothing while it evaluates the prompt, so this covers long prompt evaluation on slow hardware. |
| `maxRequestImageBytes` | `20971520` | Base64 image payload per request; older images beyond it become text placeholders. |
| `requestImagePixelBudget` | `4194304` | Total-pixel budget for each inline image. |
| `requestImageMaxBytes` | `1048576` | Encoded-byte cap for each inline image. |
| `retryPolicy` | normal, five retries | Provider-owned model-request retry policy. |

## Behavior

- **Server state is authoritative.** `listModels` and `resolveModel` probe `/props`. The model name is the GGUF file name without `.gguf`; `contextWindow` is `default_generation_settings.n_ctx`, the tokens one slot holds; `image` input is advertised only when the server runs with `--mmproj`.
- **Offline is an ordinary state.** With no server, a server still loading (HTTP 503), or router mode without a loaded model, `listModels` returns `llama.cpp (offline)` and `resolveModel` returns the model without context metadata, so the route stays selectable. `prepareCall` and `stream` fail with `LlmError` code `SERVER_UNAVAILABLE`, which names the reason and the address.
- **Only `loaded` is served.** Any other model id fails with `UNKNOWN_MODEL`. The id names the role rather than a file, so a saved selection stays valid across model switches.
- **Wire format.** Requests go to `<baseURL>/v1/chat/completions` through the pi-ai `openai-completions` client, driven by `PiAiAdapter` from `dsh-llm-pi-ai`. Reasoning deltas (`reasoning_content`), tool calls, usage, and finish reasons arrive as the standard `StreamChunk` sequence.
- **One state per call.** A changed server state builds a new provider profile, and each call keeps the profile it was prepared with.

## Model Experience

### Requests to the served model

#### What the model sees

The request the agent loop assembled, forwarded unchanged to `/v1/chat/completions`. This package adds no text; the served model's chat template renders the system prompt, tool schemas, and history.

#### Token effect

Zero direct tokens. The context window read from `/props` bounds the whole request, so compaction triggers relative to the server's per-slot context.

#### KV Cache effect

Prefix-stable: requests are forwarded unchanged and llama-server reuses its own prompt cache. A hybrid-attention model reuses it only from saved context checkpoints, so a compaction that rewrites earlier history makes the server evaluate the prompt again.

## Known Limitations and Deferred Work

- **No selectable reasoning effort** — the model is declared non-reasoning, so thinking follows the chat template's default and selectors offer no effort control; a `chat_template_kwargs` mapping (`enable_thinking`) would add it.
- **One model per route** — a llama-server in router mode serving several models is described only through the model `/props` reports without a `model` query.
- **Probe per call** — each prepared call issues one `GET /props` before the completion request; with a remote server this adds one round trip per model step.
