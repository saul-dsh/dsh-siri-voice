/**
 * dsh-siri-voice 的 web 客户端部分。
 *
 * 只做一件事：内置语音输入进入录音（或转写）状态时，在输入框上方浮出一条
 * Siri 风格的跑马灯——外圈旋转的流光 + 随麦克风音量起伏的多层声波。
 *
 * 触发信号不抢槽位、不改内置插件：内置语音栏在录音阶段会给自己的容器加
 * `data-voice-activity="recording"`（见 VoiceInput.tsx），这里用 MutationObserver
 * 观察这个属性即可知道何时开始/结束。音量由本插件自己开一路 Web Audio
 * 分析器获取（此时麦克风权限已由内置按钮授予，不会二次弹窗）。
 *
 * 视觉层用 fixed 定位，锚点是它在输入框上方 dock 槽里的父容器：dock 行高只有
 * 二十来像素，装不下 56px 的波形带，所以自身脱离文档流、按父容器的位置贴到
 * 输入框正上方，未激活时完全不占布局。
 */

window.__ModuleLoader__.load({
  id: 'dsh-siri-voice',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-siri-voice-style'
    const ACTIVITY_SELECTOR = '[data-voice-activity]'
    const BAND_HEIGHT = 56
    const BAND_GAP = 8

    const CSS = `
.dsh-siri-band {
  position: fixed;
  height: ${BAND_HEIGHT}px;
  border-radius: 14px;
  overflow: hidden;
  pointer-events: none;
  z-index: 30;
  background: radial-gradient(120% 180% at 50% 50%, rgba(96, 140, 255, 0.20), rgba(12, 14, 22, 0) 72%);
  box-shadow: 0 0 26px rgba(96, 140, 255, 0.22);
}
.dsh-siri-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.dsh-siri-ring {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  padding: 1px;
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
`

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
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
      { amplitude: 0.34, frequency: 1.5, speed: 1.35, width: 2.4, alpha: 0.9, rgb: '96, 150, 255' },
      { amplitude: 0.24, frequency: 2.4, speed: 1.9, width: 1.7, alpha: 0.6, rgb: '168, 118, 255' },
      { amplitude: 0.15, frequency: 3.7, speed: 2.6, width: 1.2, alpha: 0.4, rgb: '86, 224, 255' },
    ]

    /**
     * 画布动画：音量驱动振幅，三条相位不同的正弦叠加成 Siri 波纹；
     * 每帧把浮动层贴到 dock 父容器上方，保证不依赖槽位行高。
     */
    function useVisualizer(bandRef, canvasRef, phase) {
      React.useEffect(() => {
        const recording = phase === 'recording'
        if (!recording && phase !== 'requesting' && phase !== 'transcribing') return
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
        const started = performance.now()

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

        const measure = () => {
          const anchor = band.parentElement
          const anchorRect = anchor?.getBoundingClientRect()
          if (anchorRect && anchorRect.width > 0) return anchorRect
          const editors = [...document.querySelectorAll('textarea, [contenteditable="true"]')]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 200 && rect.height > 0)
          return editors.length > 0 ? editors[editors.length - 1] : null
        }

        const place = () => {
          const rect = measure()
          const viewport = window.innerWidth
          const width = Math.max(240, Math.min(rect ? rect.width : viewport * 0.62, viewport - 32))
          const left = rect ? rect.left + (rect.width - width) / 2 : (viewport - width) / 2
          const top = rect ? rect.top - BAND_HEIGHT - BAND_GAP : 96
          band.style.width = `${Math.round(width)}px`
          band.style.left = `${Math.round(Math.max(8, Math.min(left, viewport - width - 8)))}px`
          band.style.top = `${Math.round(Math.max(8, top))}px`
        }

        const draw = (now) => {
          frame = requestAnimationFrame(draw)
          place()
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
          let target = 0.12 + 0.06 * Math.sin(time * 1.4)
          if (analyser && samples) {
            analyser.getFloatTimeDomainData(samples)
            let sum = 0
            for (const value of samples) sum += value * value
            target = Math.min(1, Math.sqrt(sum / samples.length) * 9)
          }
          level += (target - level) * 0.25

          const mid = height / 2
          for (const layer of LAYERS) {
            ctx.beginPath()
            for (let x = 0; x <= width; x += 2) {
              const u = x / width
              const envelope = Math.sin(Math.PI * u)
              const y = mid
                + Math.sin(u * Math.PI * 2 * layer.frequency + time * layer.speed) * height * layer.amplitude * level * envelope
                + Math.sin(u * Math.PI * layer.frequency - time * layer.speed * 0.7) * height * layer.amplitude * 0.35 * level * envelope
              if (x === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.strokeStyle = `rgba(${layer.rgb}, ${layer.alpha * (0.45 + level * 0.55)})`
            ctx.lineWidth = layer.width
            ctx.lineCap = 'round'
            ctx.shadowBlur = 12
            ctx.shadowColor = `rgba(${layer.rgb}, 0.55)`
            ctx.stroke()
          }
        }
        frame = requestAnimationFrame(draw)

        return () => {
          disposed = true
          cancelAnimationFrame(frame)
          if (stream) stream.getTracks().forEach((track) => track.stop())
          if (audio) void audio.close().catch(() => {})
        }
      }, [bandRef, canvasRef, phase])
    }

    /** 输入框上方的跑马灯；不在语音活动期时不渲染任何东西。 */
    function SiriVoiceBand() {
      const phase = useVoicePhase()
      const bandRef = React.useRef(null)
      const canvasRef = React.useRef(null)
      useVisualizer(bandRef, canvasRef, phase)
      if (phase === null || phase === 'feedback') return null
      return h('div', { ref: bandRef, className: 'dsh-siri-band', 'aria-hidden': true },
        h('canvas', { ref: canvasRef, className: 'dsh-siri-canvas' }),
        h('div', { className: 'dsh-siri-ring' }, h('div', { className: 'dsh-siri-ring-spin' })))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ensureStyle()
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'siri-voice',
          order: 50,
        }, SiriVoiceBand))
      },
    }
  },
})
