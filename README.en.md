# dsh-siri-voice

English | [简体中文](README.md)

A **Siri-style voice visualizer** for the [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) composer: when you start dictating, a glowing band floats above the input — a rotating conic-gradient running light around the edge, with three layers of waves driven by your microphone level.

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
- The visualizer registers on `conversation.input.dock`; since that row is only ~20px tall, the band is `position: fixed` and re-anchored to the composer every frame.
- Level comes from this plugin's own `getUserMedia + AnalyserNode` (permission already granted by the built-in button, so no second prompt). Without audio it degrades to a slow breathing animation.
- No WebGL, no third-party dependencies — one canvas.

## Notes

- Depends on the `data-voice-activity` attribute written by the built-in voice plugin; if dsh renames it, the band stops appearing (recording itself is unaffected).
- If microphone permission is denied, the band shows the synthetic animation only.

## License

[MIT](LICENSE)
