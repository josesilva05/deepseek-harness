# @deepseek-ai/dsh-command-llamacpp

English | [中文](README.zh.md)

Human-facing `/llamacpp` command. It shows which model a llama.cpp provider route serves right now, its context window, output cap, and whether it accepts images. The command is a Consumer of the `ctx.llm` seam only: it reads the route's advertised models and resolves the first one's exact metadata, so it works with any adapter registering the configured route. It never sends anything to the model.

## Install

```sh
dsh plugin --profile web add ./packages/llm/command-llamacpp
```

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `route` | `llamacpp` | Provider route the command describes. |

## Output

```
llamacpp: Qwen3.8-27B-UD-Q5_K_M
Context window: 131,072 tokens
Output cap: 32,768 tokens
Images: yes
Select it as llamacpp/loaded.
```

The command answers with an error when the route is not registered, advertises no model, or resolves without a context window, which [`dsh-llm-llamacpp`](../llm-llamacpp/README.md) reports while no server is serving.

## Model Experience

### Human `/llamacpp` status

#### What the model sees

Nothing: the `/llamacpp` input and the status or error output are absent from model requests.

#### Token effect

Zero; running the command adds no model tokens.

#### KV Cache effect

Independent of model requests; the command does not change any request prefix.

## Known Limitations and Deferred Work

- **First model only** — a route advertising several models is described by its first entry.
