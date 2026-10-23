# dsh-siri-voice

[English](README.en.md) | 简体中文

给 [DeepSeek Harness（dsh）](https://github.com/deepseek-ai/deepseek-harness)做的**语音输入跑马灯**：点开输入框的麦克风开始说话时，输入框上方浮出一条 Siri 风格的流光带——外圈旋转的渐变光，中间三层声波随你的音量起伏。

```
点麦克风  →  录音开始  →  输入框上方浮出流光波纹  →  停止后转写照常进入草稿
```

## 效果

- 录音中：渐变光带沿边缘跑动，浪高跟着麦克风音量实时变化。
- 转写中：波形消失，光带保留，提示还在处理。
- 结束或取消：光带瞬间消失，不占任何布局。

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
- 视觉层注册在 `conversation.input.dock`；因为 dock 行高很小，浮层用 `position: fixed`，每帧按父容器位置贴到输入框正上方。
- 音量来自本插件自己的 `getUserMedia + AnalyserNode`（权限已由内置按钮授予，不会二次弹窗）；拿不到音频时退化为缓慢呼吸动画，不报错。
- 不使用 WebGL、不引入第三方依赖，只用一个 canvas。

## 注意事项

- 依赖内置语音插件写入的 `data-voice-activity` 属性；dsh 升级后如果这个属性改名，光带将不再出现（录音本身不受影响）。
- 摄像头/麦克风权限被拒绝时只有合成动画，没有真实音量起伏。

## License

[MIT](LICENSE)
