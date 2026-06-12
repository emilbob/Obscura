import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

// Each line unlocks at this many activated nodes (out of 10)
const LINES = [
  { text: 'COHERENT SIGNAL IDENTIFIED',     threshold: 2 },
  { text: 'ENCODING — NON-RANDOM SEQUENCE', threshold: 4 },
  { text: 'ORIGIN — INTELLIGENCE CONFIRMED', threshold: 7 },
  { text: 'THE UNIVERSE IS LISTENING',       threshold: 10 },
]

interface HiddenMessageProps {
  activatedCount: number
}

export default function HiddenMessage({ activatedCount }: HiddenMessageProps) {
  const lineRefs    = useRef<(HTMLDivElement | null)[]>([])
  const animatedRef = useRef<boolean[]>(LINES.map(() => false))

  // Animate newly unlocked lines
  useEffect(() => {
    LINES.forEach(({ threshold }, i) => {
      if (activatedCount >= threshold && !animatedRef.current[i]) {
        animatedRef.current[i] = true
        const el = lineRefs.current[i]
        if (el) {
          gsap.fromTo(
            el,
            { opacity: 0, x: 14 },
            { opacity: 1, x: 0, duration: 1.4, ease: 'power3.out', delay: i * 0.08 }
          )
        }
      }
    })
  }, [activatedCount])

  if (activatedCount < LINES[0].threshold) return null

  return (
    <div style={containerStyle}>
      {/* Header label */}
      <div style={headerStyle}>SIGNAL ANALYSIS</div>
      <div style={separatorStyle} />

      {/* Data lines — each starts invisible, GSAP reveals on threshold */}
      {LINES.map(({ threshold }, i) =>
        activatedCount >= threshold ? (
          <div
            key={i}
            ref={el => { lineRefs.current[i] = el }}
            style={{
              ...lineStyle,
              opacity: 0,
              color: i === LINES.length - 1
                ? 'rgba(255, 235, 160, 0.95)'  // final line: warm gold
                : 'rgba(160, 210, 255, 0.82)',
            }}
          >
            {LINES[i].text}
          </div>
        ) : null
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '5.5rem',
  right: '2.5rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '0.55rem',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 20,
}

const headerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.62rem',
  letterSpacing: '0.22em',
  color: 'rgba(74, 158, 255, 0.50)',
  textTransform: 'uppercase',
}

const separatorStyle: React.CSSProperties = {
  width: '100%',
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(74,158,255,0.22))',
  marginBottom: '0.1rem',
}

const lineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  textAlign: 'right',
  lineHeight: 1.6,
}
