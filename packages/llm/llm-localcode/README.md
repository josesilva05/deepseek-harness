---
description: "Serve the model this machine's own inference engine has open through the localcode API, under the localcode route."
kind: "package-bundle"
---

# @deepseek-ai/dsh-llm-localcode

English | [中文](README.zh.md)

## Summary

LLM adapter for the localcode API: this machine's own inference engine, started by `start-api.bat` of qwen3.8-flash-next-in-c. The plugin registers one provider route, `localcode`, that serves one model id, `loaded`: the model the engine has open when the call is made. The API answers llama-server's `GET /props` and OpenAI's `POST /v1/chat/completions`, so the route runs on the llama-server client of [`dsh-llm-llamacpp`](../llm-llamacpp/README.md); no llama.cpp code runs. The bundle also mounts the Models settings card of [`dsh-client-ui-settings-local-servers`](../../client/ui-settings-local-servers/README.md).

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

The package declares `dsh.bundle`; the reconcile step inserts the `llm-localcode` row and the `ui-settings-local-servers` card into the profile:

```sh
dsh plugin --profile web add ./packages/llm/llm-localcode
```

### What you get

The `localcode` provider route with one model, `loaded`, in every model selector, named after the model the engine has open. Select `localcode/loaded` as the model. Settings → Models lists the route with its model, context window, and address under **Local model servers**.

### Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `route` | `localcode` | Provider route this plugin registers. |
| `displayName` | `localcode` | Route name shown by selectors. |
| `baseURL` | — | API origin without `/v1`; http or https. Omitted, the plugin reads `baseURLEnv` from the launch environment, then falls back to `http://127.0.0.1:8080`, where `start-api.bat` listens. |
| `baseURLEnv` | `LOCALCODE_BASE_URL` | Environment variable `start-api.bat --harness` sets for the API it started. |
| `probeTimeoutMs` | `5000` | Upper bound for one `GET /props` probe. |
| `maxTokens` | `8192` | Output cap for a request that names none; clamped to the served context window. Compaction reserves this cap out of the window, so it stays well below a 32k window. |
| `streamIdleTimeoutMs` | `1800000` | Maximum silence while a stream read is outstanding; covers the longest prompt read on this machine's engine. |
| `retryPolicy` | normal, five retries | Provider-owned model-request retry policy. |

### Failures and recovery

With the API stopped or still loading, `listModels` returns `localcode (offline)` with the reason as its description, so the route stays selectable. `prepareCall` and `stream` fail with `LlmError` code `SERVER_UNAVAILABLE`, ending with `start the localcode API (start-api.bat) at <address>`. A `baseURL` that is not an http(s) URL fails the plugin at load with an `llm-localcode:` message.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

`apply` validates the route's own fields, lets the `dsh-llm-llamacpp` schema fill the fields this route leaves at their defaults (no API key, the image limits), resolves the address with `resolveConfig`, and registers the route with `registerLlamaServerRoute` under its own plugin name and start hint. Probing, the model description, wire serialization, and the offline behavior are the llama-server client's. No runtime invariant is published: the package owns no state or event sequence beyond the route registration the LLM service records.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[llama-server client](../llm-llamacpp/README.md) · [Local model servers card](../../client/ui-settings-local-servers/README.md) · [pi-ai adapter](../llm-pi-ai/README.md)

-----

<a id="model-experience"></a>
## Model Experience

### Requests to the served model

#### What the model sees

The request the agent loop assembled, forwarded unchanged to `/v1/chat/completions`. This package adds no text; the engine's chat template renders the system prompt, tool schemas, and history.

#### Token effect

Zero direct tokens. The context window read from `/props` bounds the whole request, so compaction triggers relative to the engine's context.

#### KV Cache effect

Prefix-stable: requests are forwarded unchanged. The API keeps a request's state to continue the next one, and keeps the first turn of a prompt (the system prompt and tool schemas) in a file, so a new conversation does not read it again.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No selectable reasoning effort** — the route declares the model non-reasoning, so thinking follows the API's default effort.
- **Probe per call** — each prepared call issues one `GET /props` before the completion request.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
