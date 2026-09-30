---
description: "Prepare and operate a local CPU Whisper worker on demand, with Portuguese as the first language."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-speech-to-text-whisper

English | [中文](README.zh.md)

## Summary

This provider recognizes speech with Whisper small (ONNX encoder and decoder) and Silero VAD on the Host CPU through sherpa-onnx. It exists for languages SenseVoice does not cover; its language hints are `pt`, `en` and `auto`. Activation checks cached resources without loading models or downloading assets.

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

The [bundle](../voice-input-bundle/README.md) supplies an absolute `dataRoot` under the DSH home and selects this provider (`whisper-local`) with Portuguese as the default language. Preparation downloads the revision-pinned encoder, decoder, `small-tokens.txt` and Silero VAD, verifies their sizes and SHA-256 hashes, then loads them. `precision` defaults to `int8` (about 375 MB); `fp32` selects the reference weights (about 970 MB). `modelDirectory` supplies an existing absolute directory containing the selected encoder, decoder and tokens; `vadModelPath` selects an existing Silero ONNX file. Verified completed files remain reusable after cancellation or failure.

Source selection, retries, download failure reporting and cache inspection follow the [SenseVoice provider](../speech-to-text-sensevoice/README.md): Hugging Face-compatible `modelOrigins` are probed before each missing asset, an explicit `modelOrigin` disables probing and fallback, and complete verified caches restore readiness immediately after inspection.

The language hint `auto` maps to Whisper's empty language, which makes sherpa-onnx detect the spoken language. Regional tags such as `pt-BR` are rejected before inference because Whisper accepts only base language codes.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

The worker, queue, deadlines, cancellation and idle release match the SenseVoice provider; only the model files and the native recognizer configuration differ. The recognizer is created once per worker with an empty language and updated per recording with the requested hint before inference. Invalid language or WAV input is rejected before native inference and retains the loaded worker. No runtime invariant companion is published because `dsh-subprocess` owns process-range observations and this provider has no independent projection to reconcile.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[Voice input subsystem](../../../docs/subsystems/voice-input.md)

-----

<a id="model-experience"></a>
## Model Experience

### Local speech recognition

#### What the model sees

Nothing: recordings, the `pt` language hint and preparation state stay outside model requests; the transcript is inserted into the unsent draft, and ordinary user submission owns any later text.

#### Token effect

Zero; recognition adds no model tokens.

#### KV Cache effect

Independent of model requests; recognition changes no request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- CPU only, with the same native platform targets as the SenseVoice provider. Language hints are Portuguese, English and automatic detection; other Whisper languages are not offered yet. The voice settings screen shows the raw `pt` code because its language-name table lives in the client package. Model memory exceeds file size and grows with recording length.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
