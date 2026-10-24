# 贡献指南

感谢你愿意改进这个插件。

## 提 Issue 之前

先看 README 的「故障排查」一节。仍然需要提 issue 时，请带上：

- 操作系统与版本
- dsh 版本（`dsh --version`）
- 语音输入本身是否正常（能否录音、能否转写）
- 复现步骤：点了什么、期望什么、实际什么
- 控制台里 `[siri-voice]` 开头的日志

视觉问题请附截图或录屏。

## 提 PR 之前

1. 先开 issue 讨论，避免方向不对白写一版。
2. 一个 PR 只做一件事。
3. 跑一遍自检：

```sh
node --check index.js
node --check client.js
```

4. 改了行为就更新 README。
5. 提交信息用 `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` 前缀。

## 代码约定

- **纯客户端插件**。服务端入口 `index.js` 只有一个空的 `apply`，作用是让宿主扫描到 `dsh.client.platform = 'web'`。
- **不新增依赖**。只用原生 canvas 和 Web Audio API，不引入 WebGL 或第三方动画库。
- **不接管录音流程**。只读 `data-voice-activity` 属性，不拦截麦克风、不改写转写结果。
- **失败必须静默**。拿不到音频、算不出矩形、权限被拒，都要退化到合成动画或直接不渲染，绝不抛错打断输入。
- 每帧做重活（读 DOM 矩形、算圆角）要缓存，避免布局抖动。

## 客户端改动特别注意

- 视觉层注册在 `conversation.input.dock`，这是公开槽位。
- 覆盖层用 `position: fixed` 贴合输入框卡片，不做外扩。dsh 改动输入栏结构时这里最容易失效，改动前先确认 `[data-composer-dock]` 和语音栏的层级关系。
- 内置点状声纹靠 CSS 隐藏但仍占位，取消/停止按钮的位置不能动。

## 本地联调

```sh
dsh plugin --profile web add /absolute/path/to/dsh-siri-voice
dsh plugin --profile desktop add /absolute/path/to/dsh-siri-voice
```

改完 `client.js` 需要重启 dsh 才生效。

## License

提交 PR 即表示你同意以 [MIT](LICENSE) 协议授权你的贡献。
