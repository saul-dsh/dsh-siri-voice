# dsh-siri-voice

[English](README.en.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/license-MIT-3da639.svg)](LICENSE)
[![version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/saul-dsh/dsh-siri-voice/releases)
[![dsh](https://img.shields.io/badge/dsh-%E2%89%A50.2.0-5b8def.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933.svg)](https://nodejs.org)
[![CI](https://github.com/saul-dsh/dsh-siri-voice/actions/workflows/ci.yml/badge.svg)](https://github.com/saul-dsh/dsh-siri-voice/actions)

给 [DeepSeek Harness（dsh）](https://github.com/deepseek-ai/deepseek-harness)做的**语音输入增强插件**，两件事：

1. **跑马灯**：点开麦克风开始说话时，输入框上方浮出一条 Siri 风格的流光带——外圈旋转的渐变光，中间三层声波随你的音量起伏。
2. **转写清理**：说完之后，把「嗯、呃、那个」这类语气词和重复的字词去掉，把停顿造成的碎句号改回逗号，再放进草稿。

```
点麦克风  →  流光波纹  →  停止转写  →  清理口语杂质  →  干净文本进入草稿
```

## 目录

- [效果](#效果)
- [转写清理](#转写清理)
- [安装](#安装)
- [依赖](#依赖)
- [实现要点](#实现要点)
- [兼容性](#兼容性)
- [故障排查](#故障排查)
- [相关插件](#相关插件)
- [贡献](#贡献)

## 效果

- 录音中：渐变光带沿边缘跑动，浪高跟着麦克风音量实时变化。
- 转写中：波形消失，光带保留，提示还在处理。
- 结束或取消：光带瞬间消失，不占任何布局。

## 转写清理

语音转写会把口语原样落进草稿，直接发出去很难看。插件在转写完成、文本进入草稿之后跑一遍规则清理，**纯本地正则，不调模型，零延迟零成本**。

| 问题 | 处理 | 例子 |
|---|---|---|
| 语气词 | 删行首、标点后、汉字之间的「嗯呃额唔」 | 「嗯，我觉得」→「我觉得」 |
| 口头填充「那个」 | 只删行首且后面紧跟逗号的 | 「那个，我想说」→「我想说」 |
| 重复字 | 同字三连以上合并 | 「我我我觉得」→「我觉得」 |
| 重复词 | 两三个字的词连续重复合并 | 「这个这个方案」→「这个方案」 |
| 停顿碎句 | 整段没有逗号且平均句长很短时，中间句号改逗号 | 「我今天。想去公园。」→「我今天，想去公园。」 |

**不动的**：

- 叠词：「看看」「刚刚」「试试」是合法用法，不动
- 指示代词：「那个文件」里的「那个」
- 语气助词：「好啊」里的「啊」、「对吧」里的「吧」
- 已经有逗号的正常句子
- 正常长度的完整句子

改动超过原长 40% 时判定规则失控，直接放弃清理保留原文。清理结果只写回草稿，**不会自动发送**，你可以继续改或者手动撤回。

## 安装

```sh
# 本地路径
dsh plugin --profile web add /path/to/dsh-siri-voice

# 从 GitHub
dsh plugin --profile web add https://github.com/saul-dsh/dsh-siri-voice
```

安装后重启宿主（桌面端需完全退出再启动），启动日志出现 `[siri-voice]` 相关的层即可。

## 依赖

需要 dsh 自带的语音输入 bundle 处于启用状态（`@deepseek-ai/dsh-experimental-voice-input-bundle`），因为：

- 麦克风按钮、录音与转写都由它提供；
- 本插件只读取它在录音时挂在容器上的 `data-voice-activity` 属性，不打断、不接管任何流程。

语音输入没启用时，本插件不会显示任何东西，也不影响其他功能。

## 实现要点

- 纯客户端插件：服务端入口只有一个空的 `apply`，作用是让宿主扫描到 `dsh.client.platform = 'web'`。
- 视觉层注册在 `conversation.input.dock`；每帧取「编辑器 + 语音栏」的最小公共祖先（即输入框卡片本身）的矩形与圆角，用 `position: fixed` 严丝合缝盖在卡片上，不做外扩。
- 录音时内置的点状声纹被 CSS 隐藏（仍占位，取消/停止按钮不动），画布直接画在它原来的格子里，相当于接管了那条声纹。
- 音量来自本插件自己的 `getUserMedia + AnalyserNode`（权限已由内置按钮授予，不会二次弹窗）；拿不到音频时退化为缓慢呼吸动画，不报错。
- 不使用 WebGL、不引入第三方依赖，只用一个 canvas。

## 兼容性

| 项目 | 要求 |
|---|---|
| dsh | ≥ 0.2.0（developer preview） |
| Node | ≥ 18 |
| 客户端 | web（桌面端与浏览器） |
| 前置插件 | `@deepseek-ai/dsh-experimental-voice-input-bundle` 需处于启用状态 |
| 运行时依赖 | 无。跑马灯用原生 canvas 与 Web Audio API，转写清理是纯正则 |

dsh 升级后如果这个插件突然不显示，多半是语音输入 bundle 改名或 `data-voice-activity` 属性变了。录音功能本身不受影响。

## 故障排查

**完全没有流光带**

- 先确认语音输入本身能用：点麦克风能录音、能转写
- 确认前置 bundle 已启用：`dsh --profile desktop --dump-config | grep voice-input`
- 装完没重启 dsh。客户端模块在启动时加载

**有流光带，但浪高不动**

- 麦克风权限被拒绝，或系统里有别的应用独占了麦克风。此时退化为缓慢呼吸动画，不报错
- 部分 Linux 发行版下 `getUserMedia` 拿不到音量，同样退化

**转写出来了，但语气词还在**

- 清理有 40% 改动上限保护，删太多会判定失控并放弃，保留原文
- 整段被判为「正常句子」（已经有逗号，或者平均句长超过 12 字）时，停顿句号不会合并
- 控制台有 `[dsh-siri-voice] transcript cleaned X -> Y` 记录，没有这行说明本次没触发清理

**流光带位置偏了**

- 它按「编辑器 + 语音栏」的最小公共祖先计算矩形，dsh 改动输入栏结构后可能算错
- 窗口缩放或分屏切换后如果错位，重新触发一次录音即可

**和别的输入框插件冲突**

- 它只读 `data-voice-activity` 属性，不接管录音流程。真冲突的话禁用其他插件逐个排查

## 相关插件

- [dsh-prompt-enhancer](https://github.com/saul-dsh/dsh-prompt-enhancer) —— 同一个作者，发送前自动改写提示词

## 贡献

欢迎提 issue 和 PR。动手前先读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)
