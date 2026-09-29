# @deepseek-ai/dsh-llm-llamacpp

[English](README.md) | 中文

面向正在运行的 llama.cpp `llama-server` 的 LLM 适配器。插件注册一个提供方路由（默认 `llamacpp`），只提供一个模型 id：`loaded`，即调用发生时服务器已加载的 GGUF。模型名称、每个槽位的上下文窗口以及是否支持图像，都会在每个模型步骤之前从服务器的 `GET /props` 读取；因此启动、停止或切换服务器模型都无需修改 harness 配置，压缩也按服务器实际分配的上下文进行规划。

## 安装

该包声明了 `dsh.bundle`，因此是可安装的 Profile 层：

```sh
dsh plugin --profile web add ./packages/llm/llm-llamacpp
```

选择 `llamacpp/loaded` 作为模型。搭配 [`dsh-command-llamacpp`](../command-llamacpp/README.zh.md) 可使用 `/llamacpp` 状态命令。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `route` | `llamacpp` | 插件注册的提供方路由。 |
| `displayName` | `llama.cpp` | 选择器中显示的路由名称。 |
| `baseURL` | `http://127.0.0.1:8080` | 不含 `/v1` 的服务器地址；http 或 https。Bundle 补丁优先读取 `LLAMACPP_BASE_URL`，启动器可借此让 harness 指向它启动的服务器。 |
| `apiKey` | — | 以 `--api-key` 启动的服务器所需的 Bearer 令牌；未配置时发送固定占位值。 |
| `probeTimeoutMs` | `5000` | 单次 `GET /props` 探测的上限。 |
| `maxTokens` | `32768` | 请求未指定时的输出上限；不超过服务器的上下文窗口。 |
| `streamIdleTimeoutMs` | `1800000` | 流读取期间允许的最长静默。llama-server 在评估提示时不发送任何内容，因此该值需覆盖慢速硬件上的长提示评估。 |
| `maxRequestImageBytes` | `20971520` | 每个请求的 base64 图像负载；超出部分的较早图像被替换为文本占位。 |
| `requestImagePixelBudget` | `4194304` | 每张内联图像的总像素预算。 |
| `requestImageMaxBytes` | `1048576` | 每张内联图像的编码字节上限。 |
| `retryPolicy` | normal，五次重试 | 提供方自有的模型请求重试策略。 |

## 行为

- **以服务器状态为准。** `listModels` 与 `resolveModel` 会探测 `/props`。模型名称是去掉 `.gguf` 的 GGUF 文件名；`contextWindow` 取 `default_generation_settings.n_ctx`，即一个槽位容纳的 token 数；只有服务器以 `--mmproj` 运行时才声明 `image` 输入。
- **离线是正常状态。** 没有服务器、服务器仍在加载（HTTP 503）或路由模式下未加载模型时，`listModels` 返回 `llama.cpp (offline)`，`resolveModel` 返回不含上下文元数据的模型，路由仍可被选择。`prepareCall` 与 `stream` 以 `LlmError` 代码 `SERVER_UNAVAILABLE` 失败，并给出原因和地址。
- **只提供 `loaded`。** 其他模型 id 以 `UNKNOWN_MODEL` 失败。该 id 表示角色而非文件，因此已保存的选择在切换模型后依然有效。
- **线路格式。** 请求经由 `dsh-llm-pi-ai` 的 `PiAiAdapter` 驱动的 pi-ai `openai-completions` 客户端发送到 `<baseURL>/v1/chat/completions`。推理增量（`reasoning_content`）、工具调用、用量与结束原因以标准 `StreamChunk` 序列到达。
- **每次调用一个状态。** 服务器状态变化会构建新的提供方配置，每次调用保持其准备时的配置。

## Model Experience

### 发送给服务模型的请求

#### What the model sees

agent loop 组装的请求，原样转发到 `/v1/chat/completions`。本包不添加任何文本；系统提示、工具 schema 与历史由服务模型的聊天模板渲染。

#### Token effect

直接 token 为零。从 `/props` 读取的上下文窗口约束整个请求，因此压缩按服务器的单槽位上下文触发。

#### KV Cache effect

前缀稳定：请求原样转发，llama-server 复用自己的提示缓存。混合注意力模型只能从已保存的上下文检查点复用，因此改写早期历史的压缩会让服务器重新评估提示。

## Known Limitations and Deferred Work

- **不能选择推理强度** — 模型被声明为非推理模型，思考行为遵循聊天模板默认值，选择器不提供强度控制；映射 `chat_template_kwargs`（`enable_thinking`）即可补充。
- **每个路由一个模型** — 路由模式下服务多个模型的 llama-server 只按不带 `model` 查询的 `/props` 所报告的模型来描述。
- **每次调用都探测** — 每个准备好的调用在补全请求前发出一次 `GET /props`；远程服务器会让每个模型步骤多一次往返。
