---
description: "Serve whatever model a running llama.cpp llama-server has loaded, with its live context window and modalities."
kind: "package-bundle"
---

# @deepseek-ai/dsh-llm-llamacpp

English | [中文](README.zh.md)

## Summary

LLM adapter for a running llama.cpp `llama-server`. The plugin registers one provider route (default `llamacpp`) that serves one model id, `loaded`: whatever GGUF the server has loaded when the call is made. The model name, the per-slot context window, and image support are read from the server's `GET /props` before every model step, so starting, stopping, or switching the server's model needs no harness configuration change and compaction plans against the context the server actually allocated.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

### Install into a profile

The package declares `dsh.bundle`, so it is an installable Profile layer; the reconcile step inserts the `llm-llamacpp` row into the profile:

```sh
dsh plugin --profile web add ./packages/llm/llm-llamacpp
```

### What you get

The `llamacpp` provider route with one model, `loaded`, in every model selector. Select `llamacpp/loaded` as the model. Pair it with [`dsh-command-llamacpp`](../command-llamacpp/README.md) for the `/llamacpp` status command.

### Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `route` | `llamacpp` | Provider route this plugin registers. |
| `displayName` | `llama.cpp` | Route name shown by selectors. |
| `baseURL` | — | Server origin without `/v1`; http or https. Omitted, the plugin reads `baseURLEnv` from the launch environment, then falls back to llama-server's default `http://127.0.0.1:8080`. |
| `baseURLEnv` | `LLAMACPP_BASE_URL` | Environment variable a launcher sets to point the harness at the server it started. |
| `apiKey` | — | Bearer token for a server started with `--api-key`; without it a fixed placeholder is sent. |
| `probeTimeoutMs` | `5000` | Upper bound for one `GET /props` probe. |
| `maxTokens` | `32768` | Output cap for a request that names none; clamped to the served context window. |
| `streamIdleTimeoutMs` | `1800000` | Maximum silence while a stream read is outstanding. llama-server sends nothing while it evaluates the prompt, so this covers long prompt evaluation on slow hardware. |
| `maxRequestImageBytes` | `20971520` | Base64 image payload per request; older images beyond it become text placeholders. |
| `requestImagePixelBudget` | `4194304` | Total-pixel budget for each inline image. |
| `requestImageMaxBytes` | `1048576` | Encoded-byte cap for each inline image. |
| `retryPolicy` | normal, five retries | Provider-owned model-request retry policy. |

### Failures and recovery

With no server, a server still loading (HTTP 503), or router mode without a loaded model, `listModels` returns `llama.cpp (offline)` with the reason as its description, and `resolveModel` returns the model without context metadata, so the route stays selectable. `prepareCall` and `stream` fail with `LlmError` code `SERVER_UNAVAILABLE`, which names the reason and the address. Any model id other than `loaded` fails with `UNKNOWN_MODEL`; the id names the role rather than a file, so a saved selection stays valid across model switches.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

`listModels` and `resolveModel` probe `/props`. The model name is the GGUF file name without `.gguf`; `contextWindow` is `default_generation_settings.n_ctx`, the tokens one slot holds; `image` input is advertised only when the server runs with `--mmproj`. `listModels` describes the model as `<n>-token context at <address>`. Another plugin serving a server that speaks the same API, such as [`dsh-llm-localcode`](../llm-localcode/README.md), registers its route with the exported `resolveConfig` and `registerLlamaServerRoute`, which take its plugin name for messages and the adapter's start hint for `SERVER_UNAVAILABLE`. Requests go to `<baseURL>/v1/chat/completions` through the pi-ai `openai-completions` client, driven by `PiAiAdapter` from `dsh-llm-pi-ai`; reasoning deltas (`reasoning_content`), tool calls, usage, and finish reasons arrive as the standard `StreamChunk` sequence. A changed server state builds a new provider profile, and each call keeps the profile it was prepared with.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[pi-ai adapter](../llm-pi-ai/README.md) · [LLM streaming subsystem](../../../docs/subsystems/llm-streaming.md)

-----

<a id="model-experience"></a>
## Model Experience

### Requests to the served model

#### What the model sees

The request the agent loop assembled, forwarded unchanged to `/v1/chat/completions`. This package adds no text; the served model's chat template renders the system prompt, tool schemas, and history.

#### Token effect

Zero direct tokens. The context window read from `/props` bounds the whole request, so compaction triggers relative to the server's per-slot context.

#### KV Cache effect

Prefix-stable: requests are forwarded unchanged and llama-server reuses its own prompt cache. A hybrid-attention model reuses it only from saved context checkpoints, so a compaction that rewrites earlier history makes the server evaluate the prompt again.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No selectable reasoning effort** — the model is declared non-reasoning, so thinking follows the chat template's default and selectors offer no effort control; a `chat_template_kwargs` mapping (`enable_thinking`) would add it.
- **One model per route** — a llama-server in router mode serving several models is described only through the model `/props` reports without a `model` query.
- **Probe per call** — each prepared call issues one `GET /props` before the completion request; with a remote server this adds one round trip per model step.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
