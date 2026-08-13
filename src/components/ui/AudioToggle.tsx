import { useRef, useEffect, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { isMuted, setMuted } from '../../lib/ambience'

const BOX_W = 48
const BOX_H = 44
const BAR_W = 6.5

// Resting bar heights + loop durations — deliberately unequal so the meter
// reads as live signal rather than a synced animation.
const BARS = [
  { x: 3.6,  h: 22, dur: 0.74 },
  { x: 14.9, h: 40, dur: 0.52 },
  { x: 26.2, h: 31, dur: 0.63 },
  { x: 37.5, h: 17, dur: 0.85 },
]

// Muted: every bar collapses to the same height so the row reads as one flat
// trace. Scaled per bar rather than by a shared factor, which would leave the
// tall and short bars at different heights. Deliberately chunky and undimmed —
// the off state is exactly when the control has to stay findable, so stillness
// and flatness carry the meaning rather than low contrast.
const FLAT_PX = 13

const REST_OPACITY = 0.9

interface AudioToggleProps {
  style?: React.CSSProperties
}

export default function AudioToggle({ style }: AudioToggleProps) {
  const [muted, setMutedState] = useState(isMuted)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const barRefs  = useRef<(SVGRectElement | null)[]>([])
  const loopsRef = useRef<gsap.core.Tween[]>([])

  useEffect(() => {
    const bars = barRefs.current.filter(Boolean) as SVGRectElement[]
    if (!bars.length) return

    loopsRef.current.forEach(t => t.kill())
    loopsRef.current = []

    if (muted) {
      bars.forEach((bar, i) => {
        gsap.to(bar, {
          scaleY: FLAT_PX / BARS[i].h,
          opacity: 1,
          duration: 0.4,
          ease: 'power2.inOut',
          transformOrigin: '50% 50%',
          overwrite: true,
        })
      })
      return
    }

    gsap.to(bars, { opacity: 1, duration: 0.3, overwrite: 'auto' })

    loopsRef.current = bars.map((bar, i) =>
      gsap.fromTo(bar,
        { scaleY: 0.34 },
        {
          scaleY: 1,
          duration: BARS[i].dur,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          transformOrigin: '50% 50%',
        }
      )
    )

    return () => { loopsRef.current.forEach(t => t.kill()) }
  }, [muted])

  const toggle = useCallback(() => {
    setMutedState(prev => {
      const next = !prev
      setMuted(next)
      return next
    })
  }, [])

  const hover = (enter: boolean) =>
    gsap.to(btnRef.current, { opacity: enter ? 1 : REST_OPACITY, duration: 0.25, ease: 'power2.out' })

  return (
    <button
      ref={btnRef}
      onClick={toggle}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      aria-label={muted ? 'Unmute ambient audio' : 'Mute ambient audio'}
      aria-pressed={muted}
      title={muted ? 'Ambient audio off' : 'Ambient audio on'}
      style={{
        position:       'fixed',
        background:     'none',
        border:         'none',
        padding:        0,
        cursor:         'pointer',
        opacity:        REST_OPACITY,
        pointerEvents:  'auto',
        userSelect:     'none',
        zIndex:         30,
        minWidth:       60,
        minHeight:      60,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <svg
        viewBox={`0 0 ${BOX_W} ${BOX_H}`}
        width={BOX_W}
        height={BOX_H}
        aria-hidden
        style={{
          overflow: 'visible',
          // same luminous accent the rest of the chrome carries
          filter: 'drop-shadow(0 0 8px rgba(74,158,255,0.6))',
        }}
      >
        {BARS.map((b, i) => (
          <rect
            key={i}
            ref={el => { barRefs.current[i] = el }}
            x={b.x}
            y={(BOX_H - b.h) / 2}
            width={BAR_W}
            height={b.h}
            rx={BAR_W / 2}
            fill="rgba(205, 230, 255, 1)"
          />
        ))}
      </svg>
    </button>
  )
}
