---
description: "Models settings card listing the model routes served from a server on this machine, with the model each has loaded; for users checking a local engine and maintainers adding local routes."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-local-servers

English | [中文](README.zh.md)

## Summary

This package adds **Local model servers** to Settings → Models: one card per provider route that a plugin serves from a server on this machine, such as `localcode` or `llamacpp`. Each card shows the route name, the model the server has loaded, and what the route's adapter reports beside it (the context window and address, or why the server does not serve). These routes have no API key and no Models-page row, so without this card the page shows nothing about them. It has no runtime state of its own and does not affect model requests.

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

[`dsh-llm-localcode`](../../llm/llm-localcode/README.md) mounts the card with its route. Another bundle mounts it with the row below in its patch and the package in its `dependencies`:

```yaml
- insert:
    - id: ui-settings-local-servers
      name: '@deepseek-ai/dsh-client-ui-settings-local-servers'
```

The card reads the routes when Settings → Models opens and again on **Refresh**. It lists every live provider route the Models page has no row for that the model catalog lists a model for, and renders nothing when there is none. A failed read keeps the last routes and shows the Host's message.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser half registers one entry in the Models page's `settings.models.footer` list seat under the `localServers` copy namespace. `LocalServersStore` joins three Remote reads — `llm/listProviders`, `llm/listConfigurableProviders`, and `session/modelCatalog` — into one snapshot; a read that a newer refresh overtook is dropped. The node half is an empty `apply`, so Loader keeps a host row for the browser entry. No runtime invariant is published: the card owns no durable state or event sequence.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[Models settings page](../ui-settings-models/README.md) · [localcode route](../../llm/llm-localcode/README.md) · [llama-server client](../../llm/llm-llamacpp/README.md)

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; the card reads provider and catalog metadata for display and nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Refresh on demand** — the card reads the routes when the page opens and on Refresh; a server that stops later shows as online until the next read.
- **Text status** — an offline route shows the adapter's offline label and reason as text, without a status mark.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
