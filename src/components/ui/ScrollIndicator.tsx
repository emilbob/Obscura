import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface ScrollIndicatorProps {
  delay?: number
  hide?:  boolean
}

// Fluid between a 320px and a 1440px viewport, on the same curve as the audio
// toggle and the scroll-top arrow so all three shrink together. `letterSpacing`
// is in em, so it tracks the font size on its own.
const LABEL_SIZE = 'clamp(13px, calc(11.9px + 0.34vw), 1.05rem)'
const LINE_H     = 'clamp(38px, calc(35.14px + 0.89vw), 48px)'
const LINE_W     = 'clamp(1.7px, calc(1.61px + 0.027vw), 2px)'
const STACK_GAP  = 'clamp(10px, calc(9.2px + 0.25vw), 0.8rem)'

export default function ScrollIndicator({ delay = 8.5, hide = false }: ScrollIndicatorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const hiddenRef = useRef(false)
  // Read by the intro tween when it finally fires, seconds after mount.
  const hideRef = useRef(hide)
  const introRef = useRef<gsap.core.Tween | null>(null)

  // Declared first so it runs before the intro effect on mount — which is what
  // lets hideRef be correct by the time the intro tween is created.
  useEffect(() => {
    hideRef.current = hide
    if (!ref.current) return
    if (hide) {
      hiddenRef.current = true
      // The intro reveal is delayed by several seconds; if the reader is
      // already past this point (fast scroll, or a reload that restored the
      // scroll position) it would otherwise fire later and undo this fade.
      introRef.current?.kill()
      gsap.to(ref.current, { opacity: 0, duration: 1.2, ease: 'power2.inOut', overwrite: true })
    } else if (hiddenRef.current) {
      hiddenRef.current = false
      gsap.to(ref.current, { opacity: 1, duration: 1.0, ease: 'power2.out', overwrite: true })
    }
  }, [hide])

  useEffect(() => {
    const el = ref.current
    const line = lineRef.current
    if (!el || !line) return

    gsap.set(el, { opacity: 0 })
    introRef.current = gsap.to(el, {
      opacity: 1, duration: 1.0, delay, ease: 'power2.out',
      // Mounted already hidden — stay that way.
      onStart: () => { if (hideRef.current) introRef.current?.kill() },
    })

    // Perpetual scroll line animation
    const lineTween = gsap.to(line, {
      scaleY: 0,
      transformOrigin: 'top center',
      duration: 1.2,
      delay,
      ease: 'power2.inOut',
      repeat: -1,
      repeatDelay: 0.6,
      onRepeat: () => {
        gsap.set(line, { scaleY: 1, transformOrigin: 'bottom center' })
      },
    })

    return () => {
      introRef.current?.kill()
      lineTween.kill()
    }
  }, [delay])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        bottom: 'calc(2.8rem + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: STACK_GAP,
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: LABEL_SIZE,
          letterSpacing: '0.18em',
          color: 'rgba(255, 255, 255, 1)',
          textShadow: '0 4px 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
        }}
      >
        Scroll
      </span>
      <div
        style={{
          width: LINE_W,
          height: LINE_H,
          background: 'rgba(255, 255, 255, 0.25)',
          overflow: 'hidden',
          filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.9))',
        }}
      >
        <div
          ref={lineRef}
          style={{
            width: '100%',
            height: '100%',
            background: 'rgba(255, 255, 255, 1)',
          }}
        />
      </div>
    </div>
  )
}
