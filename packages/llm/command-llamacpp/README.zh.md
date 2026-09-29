# @deepseek-ai/dsh-command-llamacpp

[English](README.md) | 中文

面向用户的 `/llamacpp` 命令。它显示某个 llama.cpp 提供方路由当前提供的模型、上下文窗口、输出上限以及是否接受图像。该命令只是 `ctx.llm` 接缝的 Consumer：读取路由公布的模型并解析第一个模型的精确元数据，因此适用于任何注册了所配置路由的适配器。它从不向模型发送任何内容。

## 安装

```sh
dsh plugin --profile web add ./packages/llm/command-llamacpp
```

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `route` | `llamacpp` | 命令描述的提供方路由。 |

## 输出

```
llamacpp: Qwen3.8-27B-UD-Q5_K_M
Context window: 131,072 tokens
Output cap: 32,768 tokens
Images: yes
Select it as llamacpp/loaded.
```

路由未注册、没有公布模型，或解析结果没有上下文窗口（[`dsh-llm-llamacpp`](../llm-llamacpp/README.zh.md) 在没有服务器提供模型时即如此报告）时，命令返回错误。

## Model Experience

### 用户的 `/llamacpp` 状态

#### What the model sees

无：`/llamacpp` 输入以及状态或错误输出都不会进入模型请求。

#### Token effect

零；运行命令不增加任何模型 token。

#### KV Cache effect

与模型请求无关；命令不改变任何请求前缀。

## Known Limitations and Deferred Work

- **只看第一个模型** — 公布多个模型的路由按其第一项描述。
