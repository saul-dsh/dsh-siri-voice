# dsh-siri-voice

English | [简体中文](README.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-3da639.svg)](LICENSE)
[![version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/saul-dsh/dsh-siri-voice/releases)
[![dsh](https://img.shields.io/badge/dsh-%E2%89%A50.2.0-5b8def.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933.svg)](https://nodejs.org)
[![CI](https://github.com/saul-dsh/dsh-siri-voice/actions/workflows/ci.yml/badge.svg)](https://github.com/saul-dsh/dsh-siri-voice/actions)

A **voice input enhancer** for the [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) composer. Two things:

1. **Running light**: when you start dictating, a glowing layer covers the input card — a rotating conic-gradient running light around its edge, with three layers of waves drawn exactly where the built-in dot waveform used to be.
2. **Transcript cleanup**: when dictation ends, filler words ("um", "uh"), repeated characters and words are stripped, and pause-induced periods are turned back into commas before the text lands in the draft.

```
click mic → glowing waves → stop → cleanup → clean text lands in the draft
```

## Cleanup

Dictation drops spoken language into the draft verbatim, which reads badly when sent. After the transcript lands, the plugin runs a rule-based pass — **pure local regex, no model call, no latency, no cost**.

| Problem | Rule | Example |
|---|---|---|
| Fillers | Strip 「嗯呃额唔」 at line start, after punctuation, or between CJK characters | 「嗯，我觉得」→「我觉得」 |
| Verbal tic 「那个」 | Only at line start followed by a comma | 「那个，我想说」→「我想说」 |
| Repeated characters | Collapse runs of the same character, 3+ | 「我我我觉得」→「我觉得」 |
| Repeated words | Collapse 2-3 character words repeated back to back | 「这个这个方案」→「这个方案」 |
| Pause fragments | Only when the whole text has no comma and short average sentence length | 「我今天。想去公园。」→「我今天，想去公园。」 |

**Left untouched**: reduplicated words (「看看」「刚刚」), demonstratives (「那个文件」), sentence-final particles (「好啊」), sentences that already contain commas, and sentences of normal length.

If the rewrite would change more than 40% of the original, the pass is abandoned and the raw transcript is kept. Cleanup only writes back to the draft — **it never sends automatically**.

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
- Cleanup fires 180ms after `data-voice-activity` goes from `transcribing` back to null (the draft state syncs a beat later), then writes back through `inputActions.setDraft`.

## Notes

- Depends on the `data-voice-activity` attribute written by the built-in voice plugin; if dsh renames it, the band stops appearing and cleanup stops firing (recording itself is unaffected).
- If microphone permission is denied, the band shows the synthetic animation only.
- Cleanup is rule-based. It will not resolve self-corrections ("no wait, I mean...") — that needs an LLM pass.

## Related

- [dsh-prompt-enhancer](https://github.com/saul-dsh/dsh-prompt-enhancer) — same author, rewrites prompts before sending

## Contributing

Issues and PRs welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

[MIT](LICENSE)
