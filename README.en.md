# dsh-siri-voice

English | [简体中文](README.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-3da639.svg)](LICENSE)
[![version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/saul-dsh/dsh-siri-voice/releases)
[![dsh](https://img.shields.io/badge/dsh-%E2%89%A50.2.0-5b8def.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933.svg)](https://nodejs.org)
[![CI](https://github.com/saul-dsh/dsh-siri-voice/actions/workflows/ci.yml/badge.svg)](https://github.com/saul-dsh/dsh-siri-voice/actions)

A **Siri-style voice visualizer** for the [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) composer: when you start dictating, a glowing layer covers the input card — a rotating conic-gradient running light around its edge, with three layers of waves drawn exactly where the built-in dot waveform used to be.

```
click mic → recording starts → glowing waves appear above the composer → transcript lands in the draft as usual
```

## Install

```sh
# Local path
dsh plugin --profile web add /path/to/dsh-siri-voice

# From GitHub
dsh plugin --profile web add https://github.com/saul-dsh/dsh-siri-voice
```

Restart the host afterwards (quit the desktop app completely, then relaunch).

## Requirements

The built-in voice-input bundle (`@deepseek-ai/dsh-experimental-voice-input-bundle`) must be enabled: it owns the microphone button, the recording and the transcription. This plugin only watches the `data-voice-activity` attribute that bundle sets while recording — it never intercepts the flow. With voice input disabled, the plugin renders nothing.

## How it works

- Client-only plugin: the server half is an empty `apply`, present so the host loader scans `dsh.client.platform = 'web'`.
- The visualizer registers on `conversation.input.dock`; every frame it takes the smallest common ancestor of the editor and the voice row (the composer card itself) and matches its rect and corner radius exactly.
- The built-in dot waveform is hidden with CSS while recording (it keeps its layout box, so the cancel/stop buttons do not move) and the canvas draws in that same slot, effectively replacing it.
- Level comes from this plugin's own `getUserMedia + AnalyserNode` (permission already granted by the built-in button, so no second prompt). Without audio it degrades to a slow breathing animation.
- No WebGL, no third-party dependencies — one canvas.

## Notes

- Depends on the `data-voice-activity` attribute written by the built-in voice plugin; if dsh renames it, the band stops appearing (recording itself is unaffected).
- If microphone permission is denied, the band shows the synthetic animation only.

## License

[MIT](LICENSE)
