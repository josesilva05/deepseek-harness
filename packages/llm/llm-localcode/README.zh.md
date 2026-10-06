---
description: "通过 localcode API 提供本机自有推理引擎当前打开的模型，路由名为 localcode。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-llm-localcode

[English](README.md) | 中文

## 概述

面向 localcode API 的 LLM 适配器：即本机自有的推理引擎，由 qwen3.8-flash-next-in-c 的 `start-api.bat` 启动。插件注册一个提供方路由 `localcode`，只提供一个模型 id：`loaded`，即调用发生时引擎打开的模型。该 API 应答 llama-server 的 `GET /props` 与 OpenAI 的 `POST /v1/chat/completions`，因此路由运行在 [`dsh-llm-llamacpp`](../llm-llamacpp/README.zh.md) 的 llama-server 客户端之上；不运行任何 llama.cpp 代码。该 bundle 同时挂载 [`dsh-client-ui-settings-local-servers`](../../client/ui-settings-local-servers/README.zh.md) 的模型设置卡片。

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

该包声明了 `dsh.bundle`；reconcile 步骤会在 profile 中插入 `llm-localcode` 行与 `ui-settings-local-servers` 卡片：

```sh
dsh plugin --profile web add ./packages/llm/llm-localcode
```

### 获得的功能

所有模型选择器中出现 `localcode` 提供方路由及其唯一模型 `loaded`，并以引擎打开的模型命名。选择 `localcode/loaded` 作为模型。设置 → 模型 的 **Local model servers** 中列出该路由及其模型、上下文窗口与地址。

### 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `route` | `localcode` | 插件注册的提供方路由。 |
| `displayName` | `localcode` | 选择器中显示的路由名称。 |
| `baseURL` | — | 不含 `/v1` 的 API 地址；http 或 https。省略时插件从启动环境读取 `baseURLEnv`，再回退到 `start-api.bat` 监听的 `http://127.0.0.1:8080`。 |
| `baseURLEnv` | `LOCALCODE_BASE_URL` | `start-api.bat --harness` 为其启动的 API 设置的环境变量。 |
| `probeTimeoutMs` | `5000` | 单次 `GET /props` 探测的上限。 |
| `maxTokens` | `8192` | 请求未指定时的输出上限；不超过服务的上下文窗口。压缩会从窗口中预留该上限，因此它远低于 32k 窗口。 |
| `streamIdleTimeoutMs` | `1800000` | 流读取期间允许的最长静默；覆盖本机引擎读取最长提示所需的时间。 |
| `retryPolicy` | normal，五次重试 | 提供方自有的模型请求重试策略。 |

### 失败与恢复

API 未运行或仍在加载时，`listModels` 返回 `localcode (offline)`，并以原因作为描述，路由仍可被选择。`prepareCall` 与 `stream` 以 `LlmError` 代码 `SERVER_UNAVAILABLE` 失败，消息以 `start the localcode API (start-api.bat) at <地址>` 结尾。不是 http(s) URL 的 `baseURL` 会让插件在加载时以 `llm-localcode:` 消息失败。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者细节 — 点击展开</summary>

`apply` 校验本路由自有的字段，由 `dsh-llm-llamacpp` 的 schema 填充本路由保持默认的字段（无 API 密钥、图像上限），用 `resolveConfig` 解析地址，再以自身的插件名与启动提示通过 `registerLlamaServerRoute` 注册路由。探测、模型描述、线路序列化与离线行为都属于 llama-server 客户端。未发布运行时不变量：除 LLM 服务记录的路由注册外，本包不拥有任何状态或事件序列。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

[llama-server 客户端](../llm-llamacpp/README.zh.md) · [本地模型服务卡片](../../client/ui-settings-local-servers/README.zh.md) · [pi-ai 适配器](../llm-pi-ai/README.zh.md)

-----

<a id="model-experience"></a>
## 模型体验

### 发往所服务模型的请求

#### 模型看到的内容

智能体循环组装的请求，原样转发到 `/v1/chat/completions`。本包不添加任何文本；引擎的聊天模板渲染系统提示、工具 schema 与历史。

#### Token 影响

零直接 token。从 `/props` 读取的上下文窗口限定整个请求，压缩按引擎的上下文触发。

#### KV Cache 影响

前缀稳定：请求原样转发。API 保留请求的状态以续接下一个请求，并把提示的第一个轮次（系统提示与工具 schema）保存在文件中，因此新对话无需再次读取。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **无可选推理强度** — 路由将模型声明为非推理模型，因此思考遵循 API 的默认强度。
- **每次调用探测** — 每个准备好的调用在补全请求前发出一次 `GET /props`。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者细节 — 点击展开</summary>

无。

</details>
