---
description: "模型设置卡片，列出由本机服务器提供的模型路由及各自加载的模型；面向检查本地引擎的用户与添加本地路由的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-local-servers

[English](README.md) | 中文

## 概述

本包在 设置 → 模型 中添加 **Local model servers**：每个由插件从本机服务器提供的提供方路由（例如 `localcode` 或 `llamacpp`）各一张卡片。每张卡片显示路由名称、服务器已加载的模型，以及路由适配器在其旁报告的内容（上下文窗口与地址，或服务器未提供服务的原因）。这些路由没有 API 密钥，也没有模型页面的行，因此没有这张卡片时页面不显示它们的任何信息。它没有自身的运行时状态，也不影响模型请求。

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

[`dsh-llm-localcode`](../../llm/llm-localcode/README.zh.md) 会随其路由挂载该卡片。其他 bundle 在其补丁中加入下面这一行，并在 `dependencies` 中声明本包，即可挂载：

```yaml
- insert:
    - id: ui-settings-local-servers
      name: '@deepseek-ai/dsh-client-ui-settings-local-servers'
```

卡片在打开 设置 → 模型 时读取路由，点击 **Refresh** 时再次读取。它列出模型页面没有对应行、且模型目录为其列出模型的每个在线提供方路由；没有这类路由时不渲染任何内容。读取失败时保留上次的路由并显示 Host 的消息。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部 — 点击展开</summary>

浏览器部分在模型页面的 `settings.models.footer` 列表位置注册一个条目，使用 `localServers` 文案命名空间。`LocalServersStore` 将三个 Remote 读取 — `llm/listProviders`、`llm/listConfigurableProviders` 与 `session/modelCatalog` — 合并为一个快照；被更新的刷新超越的读取会被丢弃。Node 部分是空的 `apply`，使 Loader 为浏览器条目保留一个 host 行。未发布运行时不变量：卡片不拥有持久状态或事件序列。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

[模型设置页面](../ui-settings-models/README.zh.md) · [localcode 路由](../../llm/llm-localcode/README.zh.md) · [llama-server 客户端](../../llm/llm-llamacpp/README.zh.md)

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现；卡片只为显示读取提供方与目录元数据，这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **按需刷新** — 卡片在打开页面和点击 Refresh 时读取路由；之后停止的服务器在下次读取前仍显示为在线。
- **文字状态** — 离线路由以文字显示适配器的离线标签与原因，没有状态标记。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者细节 — 点击展开</summary>

无。

</details>
