import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useViewport } from '../../hooks/useViewport'

interface SignalReceivedProps {
  visible: boolean
}

const TITLE = 'SIGNAL RECEIVED'

export default function SignalReceived({ visible }: SignalReceivedProps) {
  const vp           = useViewport()
  const isMobile     = vp.isMobile
  const containerRef = useRef<HTMLDivElement>(null)
  const charRefs     = useRef<(HTMLSpanElement | null)[]>([])
  const subRef       = useRef<HTMLDivElement>(null)
  const lineRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return
    const chars = charRefs.current.filter(Boolean) as HTMLSpanElement[]
    if (!chars.length) return

    const tl = gsap.timeline()

    // Characters slide up one by one
    tl.fromTo(chars,
      { opacity: 0, y: 20, rotateX: -18 },
      { opacity: 1, y: 0, rotateX: 0, duration: 1.5, stagger: 0.06, ease: 'power3.out' }
    )
    // Separator line draws in
    .fromTo(lineRef.current,
      { scaleX: 0, transformOrigin: 'center center' },
      { scaleX: 1, duration: 1.4, ease: 'power3.inOut' },
      '-=0.8'
    )
    // Coordinate sub-line fades in
    .fromTo(subRef.current,
      { opacity: 0 },
      { opacity: 0.90, duration: 2.0, ease: 'power2.out' },
      '-=0.6'
    )

    return () => { tl.kill() }
  }, [visible])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
        perspective: '700px',
        gap: '1.4rem',
        paddingTop: '12vh', // offset slightly down to clear the iris which sits above centre
      }}
    >
      {/* Main title */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 300,
          fontSize: isMobile ? 'clamp(1.7rem, 8vw, 6.2rem)' : 'clamp(2.5rem, 6.5vw, 6.2rem)',
          letterSpacing: isMobile ? '0.10em' : '0.22em',
          color: 'var(--star-white)',
          textShadow: '0 4px 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.5)',
          lineHeight: 1.15,
          textAlign: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          margin: 0,
          padding: '0 1.25rem',
        }}
      >
        {TITLE.split('').map((char, i) => (
          <span
            key={i}
            ref={el => { charRefs.current[i] = el }}
            style={{ display: 'inline-block', opacity: 0 }}
          >
            {char === ' ' ? ' ' : char}
          </span>
        ))}
      </h2>

      {/* Thin separator */}
      <div
        ref={lineRef}
        style={{
          width: 'clamp(240px, 30vw, 480px)',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(74,158,255,0.35) 30%, rgba(74,158,255,0.35) 70%, transparent)',
        }}
      />

      {/* Coordinates — matching the loading screen's Crab Nebula data */}
      <div
        ref={subRef}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(0.72rem, 1.4vw, 1.1rem)',
          letterSpacing: '0.18em',
          color: 'rgba(255, 255, 255, 1.0)',
          textShadow: '0 4px 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.5)',
          opacity: 0,
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        RA 05h 34m 32s &nbsp;·&nbsp; DEC +22° 00′ 52″ &nbsp;·&nbsp; FREQ 1420.405 MHz
      </div>
    </div>
  )
}
