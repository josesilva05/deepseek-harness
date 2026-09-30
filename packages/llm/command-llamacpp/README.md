---
description: "Show which model the local llama.cpp route serves, with its context window and image support."
kind: "package-bundle"
---

# @deepseek-ai/dsh-command-llamacpp

English | [中文](README.zh.md)

## Summary

Human-facing `/llamacpp` command. It shows which model a llama.cpp provider route serves right now, its context window, output cap, and whether it accepts images. The command is a Consumer of the `ctx.llm` seam only: it reads the route's advertised models and resolves the first one's exact metadata, so it works with any adapter registering the configured route. It never sends anything to the model.

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

The package declares `dsh.bundle`; the reconcile step inserts the `command-llamacpp` row into the profile:

```sh
dsh plugin --profile web add ./packages/llm/command-llamacpp
```

### What you get

The `/llamacpp` command in the composer:

| Field | Default | Meaning |
| --- | --- | --- |
| `route` | `llamacpp` | Provider route the command describes. |

```
llamacpp: Qwen3.8-27B-UD-Q5_K_M
Context window: 131,072 tokens
Output cap: 32,768 tokens
Images: yes
Select it as llamacpp/loaded.
```

The command answers with an error when the route is not registered, advertises no model, or resolves without a context window, which [`dsh-llm-llamacpp`](../llm-llamacpp/README.md) reports while no server is serving.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

The handler checks `ctx.llm.listProviders()` for the route, takes the first entry of `ctx.llm.listModels(route)`, and renders `ctx.llm.resolveModelInfo(route, id)` with `renderModel`. No provider package is imported, so the command depends only on the LLM Service Definition.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[llama.cpp adapter](../llm-llamacpp/README.md)

-----

<a id="model-experience"></a>
## Model Experience

### Human `/llamacpp` status

#### What the model sees

Nothing: the `/llamacpp` input and the status or error output are absent from model requests.

#### Token effect

Zero; running the command adds no model tokens.

#### KV Cache effect

Independent of model requests; the command does not change any request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **First model only** — a route advertising several models is described by its first entry.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
