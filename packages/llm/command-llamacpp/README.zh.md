---
description: "显示本地 llama.cpp 路由当前提供的模型、上下文窗口与图像支持。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-command-llamacpp

[English](README.md) | 中文

## 概述

面向用户的 `/llamacpp` 命令。它显示某个 llama.cpp 提供方路由当前提供的模型、上下文窗口、输出上限以及是否接受图像。该命令只是 `ctx.llm` 接缝的 Consumer：读取路由公布的模型并解析第一个模型的精确元数据，因此适用于任何注册了所配置路由的适配器。它从不向模型发送任何内容。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

### 安装到 profile

该包声明了 `dsh.bundle`；reconcile 步骤会在 profile 中插入 `command-llamacpp` 行：

```sh
dsh plugin --profile web add ./packages/llm/command-llamacpp
```

### 获得的功能

输入框中的 `/llamacpp` 命令：

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `route` | `llamacpp` | 命令描述的提供方路由。 |

```
llamacpp: Qwen3.8-27B-UD-Q5_K_M
Context window: 131,072 tokens
Output cap: 32,768 tokens
Images: yes
Select it as llamacpp/loaded.
```

路由未注册、没有公布模型，或解析结果没有上下文窗口（[`dsh-llm-llamacpp`](../llm-llamacpp/README.zh.md) 在没有服务器提供模型时即如此报告）时，命令返回错误。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者细节 — 点击展开</summary>

处理函数先用 `ctx.llm.listProviders()` 确认路由存在，取 `ctx.llm.listModels(route)` 的第一项，再用 `renderModel` 渲染 `ctx.llm.resolveModelInfo(route, id)`。本包不导入任何提供方包，只依赖 LLM Service Definition。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

[llama.cpp 适配器](../llm-llamacpp/README.zh.md)

-----

<a id="model-experience"></a>
## 模型体验

### 用户的 `/llamacpp` 状态

#### 模型看到什么

无：`/llamacpp` 输入以及状态或错误输出都不会进入模型请求。

#### Token 影响

零；运行命令不增加任何模型 token。

#### KV Cache 影响

与模型请求无关；命令不改变任何请求前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **只看第一个模型** — 公布多个模型的路由按其第一项描述。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者细节 — 点击展开</summary>

无。

</details>
