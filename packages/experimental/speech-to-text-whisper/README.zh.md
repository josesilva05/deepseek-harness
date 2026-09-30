---
description: "按需准备并运行本地 CPU Whisper 进程，以葡萄牙语为首选语言。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-speech-to-text-whisper

[English](README.md) | 中文

## 摘要

该提供方在 Host CPU 上通过 sherpa-onnx 使用 Whisper small（ONNX 编码器与解码器）和 Silero VAD 识别语音。它用于覆盖 SenseVoice 不支持的语言；语言提示为 `pt`、`en` 与 `auto`。激活时只检查已缓存的资源，不加载模型、不下载文件。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

[bundle](../voice-input-bundle/README.zh.md) 在 DSH home 下提供绝对路径 `dataRoot`，并选择本提供方（`whisper-local`），默认语言为葡萄牙语。准备阶段下载固定版本的编码器、解码器、`small-tokens.txt` 与 Silero VAD，校验大小与 SHA-256 后加载。`precision` 默认 `int8`（约 375 MB）；`fp32` 选择参考权重（约 970 MB）。`modelDirectory` 指向已有的绝对目录，其中包含所选编码器、解码器与 tokens；`vadModelPath` 指定已有的 Silero ONNX 文件。已校验完成的文件在取消或失败后仍可复用。

下载源选择、重试、下载失败报告与缓存检查与 [SenseVoice 提供方](../speech-to-text-sensevoice/README.zh.md) 相同：每个缺失文件下载前探测兼容 Hugging Face 的 `modelOrigins`，显式 `modelOrigin` 关闭探测与回退，完整且已校验的缓存在检查后立即恢复就绪。

语言提示 `auto` 映射为 Whisper 的空语言，由 sherpa-onnx 自动检测所说语言。`pt-BR` 等地区标签会在推理前被拒绝，因为 Whisper 只接受基础语言代码。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者细节 — 点击展开</summary>

进程、队列、截止时间、取消与空闲释放与 SenseVoice 提供方一致；只有模型文件与原生识别器配置不同。识别器在每个进程中以空语言创建一次，并在每次推理前按请求的提示更新。无效的语言或 WAV 输入在原生推理前被拒绝，已加载的进程保持可用。本包不发布运行时 invariant 伴随插件，因为进程范围观测由 `dsh-subprocess` 负责，且本提供方没有需要核对的独立投影。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

[语音输入子系统](../../../docs/subsystems/voice-input.zh.md)

-----

<a id="model-experience"></a>
## Model Experience

### 本地语音识别

#### What the model sees

无：录音、`pt` 语言提示与准备状态都不进入模型请求；转写结果插入未发送的草稿，之后的文本由用户正常提交决定。

#### Token effect

零；识别不增加任何模型 token。

#### KV Cache effect

与模型请求无关；识别不改变任何请求前缀。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- 仅支持 CPU，原生平台目标与 SenseVoice 提供方相同。语言提示为葡萄牙语、英语与自动检测；尚未提供 Whisper 的其他语言。语音设置界面显示原始代码 `pt`，因为语言名称表位于客户端包中。模型内存大于文件大小，并随录音长度增长。

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>维护者细节 — 点击展开</summary>

无。

</details>
