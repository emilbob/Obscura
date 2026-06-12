import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface ReorientationQueryProps {
  visible: boolean
}

const QUESTION = 'HAVE WE BEEN LOOKING IN THE WRONG PLACE ALL ALONG?'

export default function ReorientationQuery({ visible }: ReorientationQueryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tlRef        = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    tlRef.current?.kill()

    if (visible) {
      tlRef.current = gsap.timeline()
      tlRef.current
        .fromTo(containerRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 2.2, delay: 1.4, ease: 'power2.out' }
        )
    } else {
      tlRef.current = gsap.timeline()
      tlRef.current
        .to(containerRef.current, { opacity: 0, y: -8, duration: 1.0, ease: 'power2.in' })
    }

    return () => { tlRef.current?.kill() }
  }, [visible])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: '32vh',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.1rem',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0,
      }}
    >
      {/* Thin rule */}
      <div style={{
        width: 'clamp(120px, 18vw, 280px)',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(74,158,255,0.22) 40%, rgba(74,158,255,0.22) 60%, transparent)',
      }} />

      {/* The question */}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'clamp(0.88rem, 1.6vw, 1.15rem)',
        letterSpacing: '0.28em',
        color: 'rgba(180, 215, 255, 0.92)',
        textTransform: 'uppercase',
        textAlign: 'center',
        margin: 0,
        maxWidth: '680px',
        lineHeight: 1.8,
        padding: '0 2rem',
      }}>
        {QUESTION}
      </p>
    </div>
  )
}
