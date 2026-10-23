/**
 * dsh-siri-voice 的 web 客户端部分。
 *
 * 只做一件事：内置语音输入进入**录音**状态时，在输入框卡片上覆盖一层
 * Siri 风格跑马灯——沿卡片边缘旋转的流光 + 接管内置声纹位置的波浪。
 *
 * 触发信号不抢槽位、不改内置插件：内置语音栏在录音阶段会给自己的容器加
 * `data-voice-activity="recording"`（见 VoiceInput.tsx），这里用 MutationObserver
 * 观察这个属性即可知道何时开始/结束。音量由本插件自己开一路 Web Audio
 * 分析器获取（此时麦克风权限已由内置按钮授予，不会二次弹窗）。
 *
 * 视觉层用 fixed 定位，每帧把「编辑器 + 语音栏」的外接矩形当作输入框卡片，
 * 直接盖在它上面（pointer-events: none），未激活时完全不渲染、不占布局。
 */

window.__ModuleLoader__.load({
  id: 'dsh-siri-voice',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-siri-voice-style'
    const ACTIVITY_SELECTOR = '[data-voice-activity]'

    const CSS = `
.dsh-siri-band {
  position: fixed;
  border-radius: 16px;
  overflow: hidden;
  pointer-events: none;
  z-index: 30;
  background: radial-gradient(140% 120% at 50% 100%, rgba(96, 140, 255, 0.10), rgba(12, 14, 22, 0) 68%);
  box-shadow: inset 0 0 22px rgba(96, 140, 255, 0.18);
}
.dsh-siri-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.dsh-siri-ring {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
.dsh-siri-ring-spin {
  position: absolute;
  inset: -150%;
  background: conic-gradient(from 0deg, transparent 0 55%, rgba(96, 150, 255, 0.95) 70%, rgba(190, 120, 255, 0.95) 82%, transparent 96%);
  animation: dsh-siri-spin 2.6s linear infinite;
}
@keyframes dsh-siri-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .dsh-siri-ring-spin { animation: none; } }

/* 点击麦克风后的点火反馈：边框先亮一下再回落。 */
.dsh-siri-band--requesting { animation: dsh-siri-ignite 480ms ease-out both; }
@keyframes dsh-siri-ignite {
  0% { box-shadow: inset 0 0 0 rgba(96, 140, 255, 0); }
  35% { box-shadow: inset 0 0 36px rgba(120, 170, 255, 0.42); }
  100% { box-shadow: inset 0 0 22px rgba(96, 140, 255, 0.20); }
}

/* 转写中：只保留边框呼吸，不画波。 */
.dsh-siri-band--transcribing { animation: dsh-siri-breath 1.7s ease-in-out infinite; }
.dsh-siri-band--transcribing .dsh-siri-ring-spin { animation-duration: 4.4s; }
@keyframes dsh-siri-breath {
  0%, 100% { box-shadow: inset 0 0 12px rgba(96, 140, 255, 0.12); }
  50% { box-shadow: inset 0 0 30px rgba(120, 170, 255, 0.34); }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-siri-band--requesting, .dsh-siri-band--transcribing { animation: none; }
}

/* 录音开始的一瞬间：边框点亮，让"开始"这件事有明确反馈。 */
.dsh-siri-band--recording { animation: dsh-siri-ignite 520ms ease-out both; }

/* 停止键：外圆内方改成"外圆内声纹"——圆形按钮里放随音量起伏的竖条，
   没有常驻光晕；按钮本身也随音量轻微缩放。 */
[data-voice-activity] .dsh-siri-stop,
[data-voice-activity] .dsh-siri-cancel {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  position: relative;
}
[data-voice-activity] .dsh-siri-stop {
  /* 跟随宿主主题的工具栏底色，深色主题下不再是刺眼的白圆；
     竖条用 currentColor，直接继承按钮原本的文字色。 */
  background: var(--dsw-alias-button-tool-bar-fill, rgba(255, 255, 255, 0.08)) !important;
  box-shadow: none !important;
  animation: none !important;
  transform-origin: center center;
  transition: background 120ms ease;
}
[data-voice-activity] .dsh-siri-stop > svg { visibility: hidden !important; }
.dsh-siri-bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.5px;
  pointer-events: none;
}
.dsh-siri-bars i {
  display: block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: currentColor;
  transform: scaleY(0.3);
  transform-origin: center center;
  transition: transform 220ms ease-out;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-siri-band--recording { animation: none; }
}

/* 点击麦克风时的按下反馈：缩放 + 光晕。 */
.dsh-siri-pressed {
  transform: scale(0.9) !important;
  box-shadow: 0 0 0 6px rgba(96, 150, 255, 0.20), 0 0 26px rgba(96, 150, 255, 0.55) !important;
  transition: transform 110ms ease, box-shadow 110ms ease !important;
}

/* 隐藏内置的点状声纹（仍占位，保持取消/停止按钮位置不变），由本插件的波浪接管。
   用它的独特几何 viewBox 兜底，避免依赖父容器的属性。 */
[data-voice-activity="recording"] svg[role="img"],
svg[viewBox="0 0 640 40"] { visibility: hidden !important; }
`

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /** 给麦克风按钮加按下反馈：缩放 + 光晕，松手或超时后移除。 */
    function installPressFeedback() {
      if (typeof document === 'undefined') return () => {}
      const pressed = new Set()
      const release = () => {
        for (const element of pressed) element.classList.remove('dsh-siri-pressed')
        pressed.clear()
      }
      const onDown = (event) => {
        const target = event.target instanceof Element ? event.target.closest('button[aria-label]') : null
        if (target === null) return
        // 只认语音按钮；不用类名，避免绑定到哈希后的 CSS module 名。
        if (!/听写|语音|录音|dictat|voice|record/i.test(target.getAttribute('aria-label') ?? '')) return
        target.classList.add('dsh-siri-pressed')
        pressed.add(target)
        window.setTimeout(release, 600)
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('pointerup', release, true)
      window.addEventListener('pointercancel', release, true)
      return () => {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('pointerup', release, true)
        window.removeEventListener('pointercancel', release, true)
        release()
      }
    }

    /** 读取内置语音栏当前相位：requesting / recording / transcribing / feedback。 */
    function useVoicePhase() {
      const [phase, setPhase] = React.useState(null)
      React.useEffect(() => {
        let scheduled = false
        const read = () => {
          scheduled = false
          const host = document.querySelector(ACTIVITY_SELECTOR)
          setPhase(host === null ? null : host.getAttribute('data-voice-activity'))
        }
        const schedule = () => {
          if (scheduled) return
          scheduled = true
          queueMicrotask(read)
        }
        read()
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-voice-activity'] })
        return () => observer.disconnect()
      }, [])
      return phase
    }

    const LAYERS = [
      { amplitude: 1, frequency: 1.5, speed: 1.35, width: 2.8, alpha: 0.95, rgb: '96, 150, 255' },
      { amplitude: 0.62, frequency: 2.4, speed: 1.9, width: 2.0, alpha: 0.7, rgb: '168, 118, 255' },
      { amplitude: 0.4, frequency: 3.7, speed: 2.6, width: 1.4, alpha: 0.5, rgb: '86, 224, 255' },
    ]

    /**
     * 画布动画：音量驱动振幅，三条相位不同的正弦叠加成 Siri 波纹；
     * 每帧把浮层贴到输入框卡片上，波浪只画在内置声纹原来的格子里。
     */
    function useVisualizer(bandRef, canvasRef, phase) {
      React.useEffect(() => {
        const recording = phase === 'recording'
        if (!recording && phase !== 'transcribing' && phase !== 'requesting') return
        const band = bandRef.current
        const canvas = canvasRef.current
        if (!band || !canvas) return

        let disposed = false
        let frame = 0
        let stream
        let audio
        let analyser
        let samples
        let level = 0
        let barLevel = 0
        let card = null
        const started = performance.now()
        // CSS 之外再直接改一次内联样式：不依赖样式表的选择器匹配结果。
        const hiddenWaveforms = new Set()

        const hideBuiltinWaveform = () => {
          const svg = document.querySelector('svg[viewBox="0 0 640 40"]')
            ?? document.querySelector('[data-voice-activity] svg[role="img"]')
          if (svg === null || svg.style.visibility === 'hidden') return
          svg.style.setProperty('visibility', 'hidden', 'important')
          hiddenWaveforms.add(svg)
        }

        const restoreBuiltinWaveform = () => {
          for (const svg of hiddenWaveforms) svg.style.removeProperty('visibility')
          hiddenWaveforms.clear()
        }

        // 给录音行的停止 / 取消按钮打标记，样式在 CSS 里按标记类生效。
        const markedControls = new Set()
        const markControls = () => {
          const row = document.querySelector('[data-voice-activity="recording"]')
          if (row === null) return
          for (const button of row.querySelectorAll('button[aria-label]')) {
            const label = button.getAttribute('aria-label') ?? ''
            const kind = /停止|stop/i.test(label)
              ? 'dsh-siri-stop'
              : /取消|丢弃|cancel|discard/i.test(label) ? 'dsh-siri-cancel' : null
            if (kind === null) continue
            if (!button.classList.contains(kind)) {
              button.classList.add(kind)
              markedControls.add({ button, kind })
            }
            if (kind === 'dsh-siri-stop' && button.dataset.dshSiriBars !== '1') {
              button.dataset.dshSiriBars = '1'
              const svg = button.querySelector('svg')
              if (svg !== null) svg.style.setProperty('visibility', 'hidden', 'important')
              const bars = document.createElement('span')
              bars.className = 'dsh-siri-bars'
              for (let index = 0; index < 4; index += 1) bars.appendChild(document.createElement('i'))
              button.appendChild(bars)
            }
          }
        }
        const unmarkControls = () => {
          for (const { button, kind } of markedControls) {
            button.classList.remove(kind)
            if (kind === 'dsh-siri-stop') {
              button.querySelector('.dsh-siri-bars')?.remove()
              button.querySelector('svg')?.style.removeProperty('visibility')
              delete button.dataset.dshSiriBars
            }
          }
          markedControls.clear()
        }

        if (recording && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).then((next) => {
            if (disposed) { next.getTracks().forEach((track) => track.stop()); return }
            stream = next
            const AudioCtx = window.AudioContext ?? window.webkitAudioContext
            audio = new AudioCtx()
            const source = audio.createMediaStreamSource(next)
            analyser = audio.createAnalyser()
            analyser.fftSize = 1024
            source.connect(analyser)
            samples = new Float32Array(analyser.fftSize)
          }).catch(() => {
            // 权限被拒或设备被占用：保持合成呼吸，不打断录音本身。
          })
        }

        const pickEditor = () => [...document.querySelectorAll('textarea, [contenteditable="true"]')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.width > 200 && rect.height > 0
          })
          .sort((left, right) => right.getBoundingClientRect().width - left.getBoundingClientRect().width)[0]

        /** 编辑器与语音栏的最小公共祖先就是输入框卡片本身，直接用它的矩形和圆角。 */
        const measure = () => {
          const host = document.querySelector(ACTIVITY_SELECTOR)
          const editor = pickEditor()
          if (host && editor) {
            let node = editor.parentElement
            while (node && node !== document.body && !node.contains(host)) node = node.parentElement
            if (node && node !== document.body) {
              const rect = node.getBoundingClientRect()
              if (rect.width > 0 && rect.height > 0) {
                const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
                return { rect, radius }
              }
            }
          }
          return null
        }

        /** 严丝合缝盖在卡片上：同矩形、同圆角，不做任何外扩。 */
        const place = () => {
          const found = measure()
          card = found ? found.rect : null
          const viewport = window.innerWidth
          const width = found ? found.rect.width : Math.max(240, viewport * 0.62)
          const left = found ? found.rect.left : (viewport - width) / 2
          const top = found ? found.rect.top : 96
          const height = found ? found.rect.height : 72
          const radius = found !== null && found.radius > 0 ? found.radius : 16
          band.style.width = `${width}px`
          band.style.height = `${height}px`
          band.style.left = `${left}px`
          band.style.top = `${top}px`
          band.style.borderRadius = `${radius}px`
        }

        const draw = (now) => {
          frame = requestAnimationFrame(draw)
          place()
          hideBuiltinWaveform()
          markControls()
          const dpr = window.devicePixelRatio || 1
          const width = canvas.clientWidth
          const height = canvas.clientHeight
          if (width === 0 || height === 0) return
          if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
          }
          const ctx = canvas.getContext('2d')
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, width, height)

          const time = (now - started) / 1000
          // 拿不到麦克风数据时不要退回一条直线：给一个明显的合成起伏，
          // 至少让动效看起来是"在听"。
          let target = 0.45 + 0.22 * Math.sin(time * 3.1) + 0.12 * Math.sin(time * 7.3)
          target = Math.min(1, Math.max(0.2, target))
          if (analyser && samples) {
            analyser.getFloatTimeDomainData(samples)
            let sum = 0
            for (const value of samples) sum += value * value
            const rms = Math.sqrt(sum / samples.length)
            // 麦克风被内置录音器独占时这里可能一直是 0：那种情况保留合成起伏，
            // 不要退回一条直线。语音 RMS 通常 0.02–0.15，放大 24 倍再压缩。
            if (rms > 0.001) target = Math.min(1, Math.pow(Math.min(1, rms * 24), 0.65))
          }
          level += (target - level) * 0.32
          const drive = 0.15 + level * 0.65

          // 停止键本身尺寸不变，只让内部竖条随音量起伏。
          const stopButton = document.querySelector('[data-voice-activity="recording"] .dsh-siri-stop')
          if (stopButton !== null) {
            // 慢速取样 + 三档量化：不跟声音瞬时抖动；左右严格对称，中间最高。
            barLevel += (level - barLevel) * 0.05
            const stepped = Math.round(barLevel * 3) / 3
            const shapes = [0.45, 1, 1, 0.45]
            const bars = stopButton.querySelectorAll('.dsh-siri-bars i')
            for (let index = 0; index < bars.length; index += 1) {
              const shape = shapes[index] ?? 0.45
              bars[index].style.transform = `scaleY(${(0.3 + stepped * shape * 0.85).toFixed(3)})`
            }
          }

          // 只在拿到内置声纹的格子时画波：停止/转写阶段它已卸载，
          // 这时没有可接管的区域，就只留边流光，不再铺一条横贯卡片的线。
          const slot = document.querySelector('[data-voice-activity="recording"] svg[role="img"]')
          const slotRect = slot ? slot.getBoundingClientRect() : null
          if (card && slotRect && slotRect.width > 0) {
            const startX = slotRect.left - card.left
            const span = slotRect.width
            const mid = slotRect.top + slotRect.height / 2 - card.top
            const wave = Math.max(7, Math.min(13, slotRect.height / 2 - 7))
            for (const layer of LAYERS) {
              ctx.beginPath()
              for (let x = 0; x <= span; x += 2) {
                const u = span === 0 ? 0 : x / span
                const envelope = Math.sin(Math.PI * u)
                const px = startX + x
                const y = mid
                  + Math.sin(u * Math.PI * 2 * layer.frequency + time * layer.speed) * wave * layer.amplitude * drive * envelope
                  + Math.sin(u * Math.PI * layer.frequency - time * layer.speed * 0.7) * wave * layer.amplitude * 0.35 * drive * envelope
                if (x === 0) ctx.moveTo(px, y)
                else ctx.lineTo(px, y)
              }
              ctx.strokeStyle = `rgba(${layer.rgb}, ${layer.alpha * (0.45 + level * 0.55)})`
              ctx.lineWidth = layer.width
              ctx.lineCap = 'round'
              ctx.shadowBlur = 8
              ctx.shadowColor = `rgba(${layer.rgb}, 0.55)`
              ctx.stroke()
            }
          }
        }
        frame = requestAnimationFrame(draw)

        return () => {
          disposed = true
          cancelAnimationFrame(frame)
          restoreBuiltinWaveform()
          unmarkControls()
          if (stream) stream.getTracks().forEach((track) => track.stop())
          if (audio) void audio.close().catch(() => {})
        }
      }, [bandRef, canvasRef, phase])
    }

    /** 输入框上方的跑马灯：点火 / 录音 / 转写三个阶段各有自己的状态。 */
    function SiriVoiceBand() {
      const phase = useVoicePhase()
      const bandRef = React.useRef(null)
      const canvasRef = React.useRef(null)
      useVisualizer(bandRef, canvasRef, phase)
      if (phase !== 'requesting' && phase !== 'recording' && phase !== 'transcribing') return null
      return h('div', { ref: bandRef, className: `dsh-siri-band dsh-siri-band--${phase}`, 'aria-hidden': true },
        h('canvas', { ref: canvasRef, className: 'dsh-siri-canvas' }),
        h('div', { className: 'dsh-siri-ring' }, h('div', { className: 'dsh-siri-ring-spin' })))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ensureStyle()
        console.info('[dsh-siri-voice] client 0.2.0 active')
        ctx.effect(() => installPressFeedback())
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'siri-voice',
          order: 50,
        }, SiriVoiceBand))
      },
    }
  },
})
