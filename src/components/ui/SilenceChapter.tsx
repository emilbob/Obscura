import { useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { useViewport } from '../../hooks/useViewport'

interface SilenceChapterProps {
  progressRef: React.MutableRefObject<number>
  visible:     boolean
  onSelect?:   (id: string) => void
}

const HEADING = 'SILENCE'

// Percentages, used for both CSS positioning and the SVG's 0–100 viewBox, so
// the stars and the lines connecting them always agree.
//
// The spread has to be re-cut per shape: the wide layout's 28–72% horizontal
// range collapses to ~150px on a phone (a cramped diamond), and its 58–81%
// vertical range collapses to ~90px on a landscape phone (a flat sliver).
const LAYOUTS = {
  wide: [
    { id: 'andromeda',  name: 'Andromeda',  cx: 55, cy: 58 },
    { id: 'sombrero',   name: 'Sombrero',   cx: 28, cy: 70 },
    { id: 'whirlpool',  name: 'Whirlpool',  cx: 72, cy: 68 },
    { id: 'triangulum', name: 'Triangulum', cx: 46, cy: 81 },
  ],
  // Portrait phone: push out to the edges the labels can still afford, and use
  // the abundant vertical room.
  portrait: [
    { id: 'andromeda',  name: 'Andromeda',  cx: 60, cy: 53 },
    { id: 'sombrero',   name: 'Sombrero',   cx: 20, cy: 68 },
    { id: 'whirlpool',  name: 'Whirlpool',  cx: 80, cy: 64 },
    { id: 'triangulum', name: 'Triangulum', cx: 42, cy: 84 },
  ],
  // Landscape phone: height is the scarce axis — start higher, finish lower.
  short: [
    { id: 'andromeda',  name: 'Andromeda',  cx: 55, cy: 46 },
    { id: 'sombrero',   name: 'Sombrero',   cx: 26, cy: 64 },
    { id: 'whirlpool',  name: 'Whirlpool',  cx: 74, cy: 61 },
    { id: 'triangulum', name: 'Triangulum', cx: 45, cy: 82 },
  ],
}

// pairs in draw order — traces outer quad then centre diagonal
const LINES: [number, number][] = [
  [0, 1], // Andromeda  → Sombrero
  [1, 3], // Sombrero   → Triangulum
  [3, 2], // Triangulum → Whirlpool
  [2, 0], // Whirlpool  → Andromeda
  [0, 3], // Andromeda  → Triangulum (diagonal)
]


export default function SilenceChapter({ progressRef, visible, onSelect }: SilenceChapterProps) {
  const vp              = useViewport()
  const galaxies        = vp.isShort ? LAYOUTS.short : vp.isMobile ? LAYOUTS.portrait : LAYOUTS.wide
  // 0.55em tracking on 7 characters is wider than a phone; ease it off with
  // the type size so the heading never runs into the edges.
  const headingSize     = vp.isMobile ? 'clamp(1.6rem, 7.4vw, 2.6rem)' : 'clamp(2.5rem, 6.5vw, 6.2rem)'
  const headingTracking = vp.isMobile ? '0.34em' : '0.55em'
  const headingTop      = vp.isShort ? '16vh' : '30vh'
  const overlayRef      = useRef<HTMLDivElement>(null)
  const charRefs        = useRef<(HTMLSpanElement | null)[]>([])
  const lineRef         = useRef<HTMLDivElement>(null)
  const discoverRef     = useRef<HTMLDivElement>(null)
  const lineElemRefs    = useRef<(SVGLineElement | null)[]>([])
  const headingTlRef    = useRef<gsap.core.Timeline | null>(null)
  const discoverTlRef   = useRef<gsap.core.Timeline | null>(null)
  const discoveryShown  = useRef(false)
  const rafRef          = useRef<number>(0)

  const startLineLoop = useCallback((lineElems: SVGLineElement[]) => {
    gsap.killTweensOf(lineElems)

    lineElems.forEach((el, i) => {
      const loop = gsap.timeline({ repeat: -1, delay: i * 0.7 })
      loop
        .set(el, { strokeDasharray: 5000, strokeDashoffset: 5000, opacity: 1 })
        .to(el,  { strokeDashoffset: 0, duration: 4.0, ease: 'power1.inOut' })
        .to({},  { duration: 1.5 })
        .set(el, { strokeDashoffset: 5000 })
    })
  }, [])

  const triggerDiscovery = useCallback(() => {
    if (discoveryShown.current || !discoverRef.current) return
    discoveryShown.current = true

    const stars     = discoverRef.current.querySelectorAll<HTMLElement>('[data-star]')
    const lineElems = lineElemRefs.current.filter(Boolean) as SVGLineElement[]

    lineElems.forEach(el => {
      gsap.set(el, { strokeDasharray: 5000, strokeDashoffset: 5000, opacity: 1 })
    })

    discoverTlRef.current = gsap.timeline({
      onComplete: () => startLineLoop(lineElems),
    })
    discoverTlRef.current
      .fromTo(lineRef.current,
        { scaleX: 0, transformOrigin: 'center' },
        { scaleX: 1, opacity: 1, duration: 2.0, ease: 'power3.inOut' }
      )
      .fromTo(stars,
        { opacity: 0, scale: 0 },
        {
          opacity: 1, scale: 1, duration: 1.8, stagger: 0.35, ease: 'back.out(1.4)',
          onStart: () => { if (discoverRef.current) discoverRef.current.style.pointerEvents = 'auto' },
        },
        '-=0.6'
      )
      // Draw base lines in once, then hand off to tracer loop
      .to(lineElems, {
        strokeDashoffset: 0,
        duration: 2.8,
        stagger: 0.6,
        ease: 'power1.inOut',
      }, '-=0.6')
  }, [startLineLoop])

  useEffect(() => {
    if (!visible) {
      cancelAnimationFrame(rafRef.current)
      headingTlRef.current?.kill()
      discoverTlRef.current?.kill()
      gsap.killTweensOf(lineElemRefs.current.filter(Boolean))
      discoveryShown.current = false

      const chars = charRefs.current.filter(Boolean) as HTMLSpanElement[]
      gsap.to([overlayRef.current, ...chars, lineRef.current], {
        opacity: 0, duration: 1.0, ease: 'power2.inOut',
      })
      if (discoverRef.current) {
        discoverRef.current.style.pointerEvents = 'none'
        const stars = discoverRef.current.querySelectorAll<HTMLElement>('[data-star]')
        gsap.to(Array.from(stars), { opacity: 0, scale: 0, duration: 0.5 })
      }
      lineElemRefs.current.filter(Boolean).forEach(el => gsap.set(el, { opacity: 0 }))
      return
    }

    // Reset
    gsap.set(overlayRef.current, { opacity: 0 })
    gsap.set(lineRef.current, { scaleX: 0, opacity: 0, transformOrigin: 'center' })
    if (discoverRef.current) {
      discoverRef.current.style.pointerEvents = 'none'
      const stars = discoverRef.current.querySelectorAll<HTMLElement>('[data-star]')
      gsap.set(Array.from(stars), { opacity: 0, scale: 0 })
    }

    const chars = charRefs.current.filter(Boolean) as HTMLSpanElement[]
    gsap.set(chars, { opacity: 0, y: 20, rotateX: -18 })

    headingTlRef.current = gsap.timeline({ delay: 0.6 })
    headingTlRef.current.fromTo(chars,
      { opacity: 0, y: 20, rotateX: -18 },
      { opacity: 1, y: 0, rotateX: 0, duration: 1.5, stagger: 0.07, ease: 'power3.out' }
    )

    const tick = () => {
      const p = progressRef.current
      if (overlayRef.current) {
        overlayRef.current.style.opacity = String(Math.min(p * 0.88, 0.88))
      }
      if (p > 0.42) triggerDiscovery()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => { cancelAnimationFrame(rafRef.current) }
  }, [visible, progressRef, triggerDiscovery])

  return (
    <>
      {/* Scene veil */}
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 20,
          background: '#000002',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* SILENCE heading */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 21,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: headingTop,
          pointerEvents: 'none',
          userSelect: 'none',
          perspective: '700px',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 5000,
          fontSize: headingSize,
          letterSpacing: headingTracking,
          // tracking leaves a trailing gap after the last glyph; match it on
          // the left so the word sits optically centred
          paddingLeft: headingTracking,
          color: 'rgba(220, 235, 255, 1.0)',
          textShadow: '0 4px 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.5)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          display: 'flex',
          margin: 0,
        }}>
          {HEADING.split('').map((char, i) => (
            <span
              key={i}
              ref={el => { charRefs.current[i] = el }}
              style={{ display: 'inline-block', opacity: 0 }}
            >
              {char}
            </span>
          ))}
        </h2>
      </div>

      {/* Discovery layer — separator + constellation lines + galaxy stars */}
      <div
        ref={discoverRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 21,
          pointerEvents: 'none',
        }}
      >
        {/* Separator line */}
        <div
          ref={lineRef}
          style={{
            position: 'absolute',
            top: `calc(${headingTop} + ${headingSize} + 2.4rem)`,
            left: '50%',
            transform: 'translateX(-50%) scaleX(0)',
            width: 'clamp(160px, 40vw, 440px)',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(74,158,255,0.28) 35%, rgba(74,158,255,0.28) 65%, transparent)',
            opacity: 0,
          }}
        />

        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {LINES.map(([a, b], i) => (
            <line
              key={i}
              ref={el => { lineElemRefs.current[i] = el }}
              x1={galaxies[a].cx} y1={galaxies[a].cy}
              x2={galaxies[b].cx} y2={galaxies[b].cy}
              stroke="rgba(74,158,255,0.60)"
              strokeWidth="1.0"
              vectorEffect="non-scaling-stroke"
              opacity={0}
            />
          ))}
        </svg>

        {/* Galaxy signal stars */}
        {galaxies.map(g => (
          <GalaxyStar
            key={g.id}
            id={g.id}
            name={g.name}
            top={`${g.cy}%`}
            left={`${g.cx}%`}
            compact={vp.isMobile}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  )
}

// ── Galaxy signal star ─────────────────────────────────────────────────────────
interface GalaxyStarProps {
  id:        string
  name:      string
  top:       string
  left:      string
  compact?:  boolean
  onSelect?: (id: string) => void
}

function GalaxyStar({ id, name, top, left, compact = false, onSelect }: GalaxyStarProps) {
  const dotRef       = useRef<HTMLDivElement>(null)
  const labelRef     = useRef<HTMLDivElement>(null)
  const ringRef      = useRef<HTMLDivElement>(null)
  const pulseRef     = useRef<gsap.core.Tween | null>(null)
  // Idle breathing loop — signals the dot is clickable before the reader
  // ever hovers it. Paused during hover/click so it doesn't fight those
  // tweens over the same scale/opacity properties.
  const idlePulseRef = useRef<gsap.core.Tween | null>(null)

  const startIdlePulse = () => {
    idlePulseRef.current = gsap.to(dotRef.current, {
      scale: 1.9, opacity: 1,
      boxShadow: '0 0 12px rgba(74,158,255,1.0), 0 0 32px rgba(74,158,255,0.55)',
      duration: 1.1, ease: 'sine.inOut',
      repeat: -1, yoyo: true,
    })
  }

  useEffect(() => {
    startIdlePulse()
    return () => { idlePulseRef.current?.kill() }
  }, [])

  const onEnter = () => {
    idlePulseRef.current?.kill()
    pulseRef.current?.kill()
    if (ringRef.current) gsap.set(ringRef.current, { scale: 0.4, opacity: 0 })
    pulseRef.current = gsap.to(ringRef.current, {
      scale: 4.5, opacity: 0, duration: 1.8, ease: 'power1.out', repeat: -1,
      onStart: () => { if (ringRef.current) gsap.set(ringRef.current, { opacity: 0.65 }) },
    })
    gsap.to(dotRef.current, {
      opacity: 1, scale: 2.8,
      boxShadow: '0 0 10px rgba(74,158,255,1.0), 0 0 28px rgba(74,158,255,0.75), 0 0 60px rgba(74,158,255,0.35)',
      duration: 0.35, ease: 'back.out(1.6)',
    })
    gsap.to(labelRef.current, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' })
  }

  const onLeave = () => {
    pulseRef.current?.kill()
    gsap.set(ringRef.current, { opacity: 0 })
    gsap.to(dotRef.current, {
      opacity: 0.72, scale: 1,
      boxShadow: '0 0 7px rgba(74,158,255,0.7), 0 0 20px rgba(74,158,255,0.30)',
      duration: 0.45, ease: 'power2.out',
      onComplete: startIdlePulse,
    })
    gsap.to(labelRef.current, { opacity: 0.72, duration: 0.4, ease: 'power2.out' })
  }

  const onClick = () => {
    idlePulseRef.current?.kill()
    pulseRef.current?.kill()
    gsap.timeline()
      .to(dotRef.current, {
        opacity: 1, scale: 3.8,
        boxShadow: '0 0 18px rgba(74,158,255,1.0), 0 0 55px rgba(74,158,255,0.65), 0 0 100px rgba(74,158,255,0.28)',
        duration: 0.28, ease: 'power3.out',
      })
      .to(dotRef.current, {
        scale: 9.0, opacity: 0,
        duration: 0.65, ease: 'power2.in',
        onComplete: () => onSelect?.(id),
      })
  }

  return (
    <div
      data-star
      style={{
        position: 'absolute',
        top, left,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        cursor: 'crosshair',
        opacity: 0,
        minWidth: 44,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {/* Expanding pulse ring */}
      <div
        ref={ringRef}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 20, height: 20,
          marginTop: -10, marginLeft: -10,
          borderRadius: '50%',
          border: '1px solid rgba(74,158,255,0.65)',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Star core */}
      <div
        ref={dotRef}
        style={{
          width: 14, height: 14,
          borderRadius: '50%',
          background: 'rgba(160, 215, 255, 0.95)',
          boxShadow: '0 0 7px rgba(74,158,255,0.7), 0 0 20px rgba(74,158,255,0.30)',
          opacity: 0.72,
        }}
      />

      {/* Name label */}
      <div
        ref={labelRef}
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '0.65rem',
          fontFamily: 'var(--font-mono)',
          // narrower labels keep the outermost stars' names off the edges;
          // 0.7rem is the floor that stays readable (0.64 rendered at 10.2px)
          fontSize: compact ? '0.7rem' : '0.76rem',
          letterSpacing: compact ? '0.14em' : '0.22em',
          color: 'rgba(200, 228, 255, 1.0)',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          opacity: 0.72,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {name}
      </div>
    </div>
  )
}
