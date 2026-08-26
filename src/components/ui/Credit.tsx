import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useViewport } from '../../hooks/useViewport'

interface CreditProps {
  visible: boolean
}

export default function Credit({ visible }: CreditProps) {
  const vp      = useViewport()
  const wrapRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLAnchorElement>(null)

  // On a wide-but-short viewport (any phone in landscape, not just narrow
  // ones — e.g. 844×390) SilenceChapter pulls its heading up to 16vh and,
  // off portrait, renders it at full (untracked-down) size, so it occupies
  // the same top-right band this corner sits in. Hide there rather than
  // add another position to keep in sync with SilenceChapter's own layout.
  const effectiveVisible = visible && !vp.isShort

  useEffect(() => {
    if (!wrapRef.current) return
    gsap.to(wrapRef.current, {
      opacity:  effectiveVisible ? 1 : 0,
      duration: effectiveVisible ? 1.2 : 0.6,
      ease:     effectiveVisible ? 'power2.out' : 'power2.in',
      overwrite: true,
    })
  }, [effectiveVisible])

  const hover = (enter: boolean) => {
    gsap.to(nameRef.current, { opacity: enter ? 1 : 0.85, duration: 0.25, ease: 'power2.out' })
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: '2.5rem',
        right: 'clamp(1rem, 4vw, 2.8rem)',
        zIndex: 30,
        opacity: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.4rem',
        pointerEvents: 'none',
        userSelect: 'none',
        textAlign: 'right',
        maxWidth: '15rem',
      }}
    >
      <a
        ref={nameRef}
        href="https://emilbob.github.io/"
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => hover(true)}
        onMouseLeave={() => hover(false)}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(0.72rem, 2vw, 0.95rem)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(190, 220, 255, 0.85)',
          textDecoration: 'none',
          borderBottom: '1px solid rgba(190, 220, 255, 0.4)',
          paddingBottom: '0.15rem',
          width: 'fit-content',
          pointerEvents: effectiveVisible ? 'auto' : 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4em',
        }}
      >
        Emil Bob
        <svg
          aria-hidden
          viewBox="5 5 14 14"
          width="0.8em"
          height="0.8em"
          style={{ alignSelf: 'center' }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="6" y1="18" x2="18" y2="6" />
          <polyline points="8 6 18 6 18 16" />
        </svg>
      </a>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.92rem',
          letterSpacing: '0.02em',
          lineHeight: 1.5,
          color: 'rgba(160, 190, 230, 0.5)',
        }}
      >
        Space explorer — building instruments out of code.
      </div>
    </div>
  )
}
