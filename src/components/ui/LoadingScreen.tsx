import { useEffect, useRef, useCallback } from 'react'
import { gsap } from 'gsap'

const RADIUS = 72
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ≈ 452.39

const MESSAGES = [
  { text: 'INITIALIZING RECEIVERS',       time: 0.0 },
  { text: 'CALIBRATING ARRAY',            time: 0.48 },
  { text: 'ESTABLISHING FREQUENCY LOCK',  time: 0.96 },
  { text: 'SIGNAL DETECTED',              time: 1.44 },
  { text: 'DECODING TRANSMISSION',        time: 1.88 },
  { text: 'READY',                        time: 2.22 },
]

// Tick geometry — computed once
const MAJOR_TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 - 90) * (Math.PI / 180)
  return { x1: 100 + 86 * Math.cos(a), y1: 100 + 86 * Math.sin(a), x2: 100 + 77 * Math.cos(a), y2: 100 + 77 * Math.sin(a) }
})

const MINOR_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 - 90) * (Math.PI / 180)
  return { x1: 100 + 86 * Math.cos(a), y1: 100 + 86 * Math.sin(a), x2: 100 + 83 * Math.cos(a), y2: 100 + 83 * Math.sin(a) }
})

interface LoadingScreenProps {
  onComplete: () => void
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const arcRef       = useRef<SVGCircleElement>(null)
  const glowArcRef   = useRef<SVGCircleElement>(null)
  const statusRef    = useRef<HTMLSpanElement>(null)
  const dotRef       = useRef<SVGCircleElement>(null)
  const enterRef     = useRef<HTMLDivElement>(null)
  const readyRef     = useRef(false)

  // Called on click — must be synchronous so audio.play() fires inside the gesture context
  const handleEnter = useCallback(() => {
    if (!readyRef.current) return
    readyRef.current = false
    onComplete()
    const container = containerRef.current
    if (!container) return
    gsap.to(container, {
      opacity: 0,
      duration: 0.65,
      ease: 'power2.inOut',
      onComplete: () => { container.style.display = 'none' },
    })
  }, [onComplete])

  useEffect(() => {
    const arc       = arcRef.current
    const glowArc   = glowArcRef.current
    const status    = statusRef.current
    const dot       = dotRef.current
    const enter     = enterRef.current
    const container = containerRef.current
    if (!arc || !glowArc || !status || !dot || !enter || !container) return

    const tl = gsap.timeline()

    // Arc sweeps 0 → full circle
    tl.to([arc, glowArc], {
      strokeDashoffset: 0,
      duration: 2.3,
      ease: 'power2.inOut',
    }, 0)

    // Dot pulses subtly
    tl.to(dot, { opacity: 0.3, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0)

    // Status message cycling
    MESSAGES.forEach(({ text, time }, i) => {
      if (i === 0) return
      const isReady = text === 'READY'

      tl.call(() => {
        if (!status) return
        gsap.to(status, {
          opacity: 0,
          y: -6,
          duration: 0.12,
          onComplete: () => {
            if (!status) return
            status.textContent = text
            if (isReady) {
              status.style.color         = 'rgba(74, 158, 255, 1.0)'
              status.style.letterSpacing = '0.38em'
            }
            gsap.fromTo(status,
              { opacity: 0, y: 6 },
              { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
            )
          },
        })
      }, [], time)
    })

    // ~0.55s after READY: fade in the ENTER prompt, then arm click
    tl.call(() => {
      gsap.fromTo(enter,
        { opacity: 0, y: 8 },
        {
          opacity: 1, y: 0, duration: 0.55, ease: 'power2.out',
          onComplete: () => {
            readyRef.current = true
            // Pulse subtly to invite interaction
            gsap.to(enter, { opacity: 0.35, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' })
          },
        }
      )
    }, [], 2.22 + 0.55)

    return () => { tl.kill() }
  }, [onComplete])

  return (
    <div
      ref={containerRef}
      onClick={handleEnter}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000002',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(74,158,255,0.018) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(74,158,255,0.018) 40px)
        `,
      }}
    >
      {/* Corner — top left */}
      <Corner pos="top-left">RA 05h 34m 32.0s</Corner>

      {/* Corner — top right */}
      <Corner pos="top-right">DEC +22° 00′ 52″</Corner>

      {/* Precision dial */}
      {/* 52vh cap: sized on width alone the dial overflows a landscape phone,
          pushing the status line and ENTER prompt off the bottom edge. */}
      <svg viewBox="0 0 200 200" style={{ overflow: 'visible', width: 'min(380px, 82vw, 52vh)', height: 'min(380px, 82vw, 52vh)' }}>
        {/* Outer decorative ring */}
        <circle cx="100" cy="100" r="90" stroke="rgba(74,158,255,0.06)" strokeWidth="1" fill="none" />

        {/* Minor ticks */}
        {MINOR_TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="rgba(74,158,255,0.18)" strokeWidth="0.5" />
        ))}

        {/* Major ticks */}
        {MAJOR_TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="rgba(74,158,255,0.5)" strokeWidth="1" />
        ))}

        {/* Progress track */}
        <circle cx="100" cy="100" r={RADIUS}
          stroke="rgba(74,158,255,0.10)" strokeWidth="1" fill="none" />

        {/* Bloom/glow arc */}
        <circle
          ref={glowArcRef}
          cx="100" cy="100" r={RADIUS}
          stroke="rgba(100,180,255,0.22)"
          strokeWidth="5"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ filter: 'blur(2px)' }}
        />

        {/* Progress arc — crisp */}
        <circle
          ref={arcRef}
          cx="100" cy="100" r={RADIUS}
          stroke="rgba(74,158,255,0.88)"
          strokeWidth="1"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
        />

        {/* Crosshair */}
        <line x1="97" y1="100" x2="103" y2="100" stroke="rgba(74,158,255,0.35)" strokeWidth="0.5" />
        <line x1="100" y1="97" x2="100" y2="103" stroke="rgba(74,158,255,0.35)" strokeWidth="0.5" />

        {/* Center dot */}
        <circle ref={dotRef} cx="100" cy="100" r="2" fill="rgba(74,158,255,0.75)" />
      </svg>

      {/* Status line */}
      <div style={{ marginTop: '2.2rem', height: '1.4rem', display: 'flex', alignItems: 'center' }}>
        <span
          ref={statusRef}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(0.72rem, 3.2vw, 1.35rem)',
            letterSpacing: '0.22em',
            color: 'rgba(74, 158, 255, 0.65)',
            textTransform: 'uppercase',
            transition: 'none',
          }}
        >
          INITIALIZING RECEIVERS
        </span>
      </div>

      {/* Enter prompt — fades in after READY, pulses to invite click */}
      <div
        ref={enterRef}
        style={{
          marginTop: '2.6rem',
          opacity: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(0.68rem, 3vw, 1.30rem)',
          letterSpacing: '0.42em',
          color: 'rgba(74, 158, 255, 0.80)',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        — ENTER —
      </div>

      {/* Corner — bottom left */}
      <Corner pos="bottom-left">FREQ 1420.405 MHz</Corner>

      {/* Corner — bottom right */}
      <Corner pos="bottom-right">ALT 2,387m</Corner>
    </div>
  )
}

function Corner({ pos, children }: { pos: string; children: string }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    fontFamily: 'var(--font-mono)',
    // floor raised from 0.55rem: that bottomed out at 8.8px on every phone,
    // well under a readable size for mono at this opacity
    fontSize: 'clamp(0.68rem, 1.8vw, 1.10rem)',
    letterSpacing: '0.14em',
    color: 'rgba(200, 216, 240, 0.35)',
    pointerEvents: 'none',
  }
  if (pos === 'top-left')    return <div style={{ ...style, top: '2.2rem', left: '2.5rem' }}>{children}</div>
  if (pos === 'top-right')   return <div style={{ ...style, top: '2.2rem', right: '2.5rem', textAlign: 'right' }}>{children}</div>
  if (pos === 'bottom-left') return <div style={{ ...style, bottom: '2.2rem', left: '2.5rem' }}>{children}</div>
  return                            <div style={{ ...style, bottom: '2.2rem', right: '2.5rem', textAlign: 'right' }}>{children}</div>
}
