import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface ChapterIndicatorProps {
  chapter: number
  total?:  number
  delay?:  number
}

const DOT_GAP    = 38   // px between dot centers
const DOT_SIZE   = 6    // px, resting
const TRACK_W    = 1    // px

export default function ChapterIndicator({ chapter, total = 7, delay = 0 }: ChapterIndicatorProps) {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const fillRef   = useRef<HTMLDivElement>(null)
  const dotRefs   = useRef<(HTMLDivElement | null)[]>([])

  const totalH = (total - 1) * DOT_GAP

  // Fade in on mount
  useEffect(() => {
    if (!wrapRef.current) return
    gsap.fromTo(wrapRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.2, delay, ease: 'power2.out' }
    )
  }, [delay])

  // Animate on chapter change
  useEffect(() => {
    const progress = (chapter - 1) / (total - 1)

    // Fill track up to active dot
    if (fillRef.current) {
      gsap.to(fillRef.current, {
        scaleY: progress,
        duration: 0.7,
        ease: 'power3.out',
      })
    }

    // Update dots
    dotRefs.current.forEach((dot, i) => {
      if (!dot) return
      const active = i + 1 === chapter
      gsap.to(dot, {
        width:     active ? DOT_SIZE + 4 : DOT_SIZE,
        height:    active ? DOT_SIZE + 4 : DOT_SIZE,
        marginLeft: active ? -((DOT_SIZE + 4) / 2) : -(DOT_SIZE / 2),
        marginTop:  active ? -((DOT_SIZE + 4) / 2) : -(DOT_SIZE / 2),
        opacity:   active ? 1 : 0.45,
        boxShadow: active
          ? '0 0 8px rgba(74,158,255,1.0), 0 0 20px rgba(74,158,255,0.55)'
          : 'none',
        duration: 0.5,
        ease: 'power2.out',
      })
    })
  }, [chapter, total])

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        left: '2.1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        width: DOT_SIZE + 4,
        height: totalH,
        zIndex: 30,
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      {/* Background track */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        width: TRACK_W,
        height: '100%',
        transform: 'translateX(-50%)',
        background: 'rgba(74, 158, 255, 0.22)',
      }} />

      {/* Active fill — scales from top */}
      <div
        ref={fillRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          width: TRACK_W,
          height: '100%',
          transform: 'translateX(-50%) scaleY(0)',
          transformOrigin: 'top',
          background: 'rgba(74, 158, 255, 0.70)',
        }}
      />

      {/* Dots */}
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 === chapter
        return (
          <div
            key={i}
            ref={el => { dotRefs.current[i] = el }}
            style={{
              position: 'absolute',
              left: '50%',
              top: i * DOT_GAP,
              width:      active ? DOT_SIZE + 4 : DOT_SIZE,
              height:     active ? DOT_SIZE + 4 : DOT_SIZE,
              marginLeft: active ? -((DOT_SIZE + 4) / 2) : -(DOT_SIZE / 2),
              marginTop:  active ? -((DOT_SIZE + 4) / 2) : -(DOT_SIZE / 2),
              borderRadius: '50%',
              background: 'rgba(74, 158, 255, 0.95)',
              opacity: active ? 1 : 0.45,
              boxShadow: active
                ? '0 0 8px rgba(74,158,255,1.0), 0 0 20px rgba(74,158,255,0.55)'
                : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
