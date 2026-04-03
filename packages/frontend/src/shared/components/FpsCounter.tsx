import { reatomFactoryComponent } from '@reatom/react'
import { atom, effect, wrap } from '@reatom/core'

const fps = atom(0, 'debug.fps')
const frameTimes = atom<number[]>([], 'debug.frameTimes')

// Measure FPS using requestAnimationFrame loop
let measuring = false

function startMeasuring() {
  if (measuring) return
  measuring = true

  let lastTime = performance.now()
  let frameCount = 0

  const loop = () => {
    if (!measuring) return
    const now = performance.now()
    const delta = now - lastTime
    frameCount++

    // Update FPS every 500ms
    if (delta >= 500) {
      const currentFps = Math.round((frameCount / delta) * 1000)
      fps.set(currentFps)

      // Keep last 60 samples for sparkline
      frameTimes.set((prev) => {
        const next = [...prev, currentFps].slice(-60)
        return next
      })

      frameCount = 0
      lastTime = now
    }

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}

function stopMeasuring() {
  measuring = false
}

export const FpsCounter = reatomFactoryComponent(() => {
  startMeasuring()

  // Auto-stop on unmount
  effect(() => {
    return () => stopMeasuring()
  }, 'debug.fpsCleanup')

  return () => {
    const currentFps = fps()
    const times = frameTimes()

    const color = currentFps >= 55 ? '#218b30'
      : currentFps >= 30 ? '#ffb900'
      : '#d1003e'

    // Mini sparkline
    const max = Math.max(...times, 1)
    const sparkWidth = 120
    const sparkHeight = 20
    const points = times.map((v, i) => {
      const x = (i / 59) * sparkWidth
      const y = sparkHeight - (v / max) * sparkHeight
      return `${x},${y}`
    }).join(' ')

    return (
      <div
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          zIndex: 9999,
          background: 'rgba(16,15,13,0.9)',
          border: '1px solid rgba(246,245,243,0.09)',
          borderRadius: 8,
          padding: '6px 10px',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#9f9e9c',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(4px)',
        }}
      >
        <svg width={sparkWidth} height={sparkHeight} style={{ display: 'block' }}>
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
        </svg>
        <span style={{ color, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
          {currentFps} fps
        </span>
      </div>
    )
  }
}, 'FpsCounter')
