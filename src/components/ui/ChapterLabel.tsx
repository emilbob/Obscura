import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

const CHAPTERS: Record<number, string> = {
  1: '01 — The Signal',
  2: '02 — Mapping',
  3: '03 — The Archive',
  4: '04 — The Collection',
  5: '05 — Reorientation',
  6: '06 — Alignment',
  7: '07 — Silence',
}

interface ChapterLabelProps {
  chapter: number
  delay?: number
}

export default function ChapterLabel({ chapter, delay = 0 }: ChapterLabelProps) {
  const ref     = useRef<HTMLDivElement>(null)
  const prevRef = useRef<number>(0)

  useEffect(() => {
    if (!ref.current) return
    gsap.set(ref.current, { opacity: 0, y: -8 })
    gsap.to(ref.current, { opacity: 1, y: 0, duration: 1.2, delay, ease: 'power3.out' })
  }, [delay])

  useEffect(() => {
    if (prevRef.current === chapter || !ref.current) {
      prevRef.current = chapter
      return
    }
    prevRef.current = chapter

    gsap.to(ref.current, {
      opacity: 0,
      y: 6,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        if (!ref.current) return
        ref.current.textContent = CHAPTERS[chapter] ?? ''
        gsap.fromTo(ref.current,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }
        )
      },
    })
  }, [chapter])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: '2.5rem',
        left: '2.8rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '1.05rem',
        letterSpacing: '0.16em',
        color: 'var(--signal-blue)',
        opacity: 0,
        pointerEvents: 'none',
        userSelect: 'none',
        textTransform: 'uppercase',
        zIndex: 30,
      }}
    >
      {CHAPTERS[chapter]}
    </div>
  )
}
