import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

const fmt = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(3)
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function CustomCursor() {
  const ringRef   = useRef<HTMLDivElement>(null)
  const dotRef    = useRef<HTMLDivElement>(null)
  const coordRef  = useRef<HTMLDivElement>(null)
  const xValRef   = useRef<HTMLSpanElement>(null)
  const yValRef   = useRef<HTMLSpanElement>(null)
  const isVisible = useRef(false)
  const counter   = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (IS_TOUCH) return
    const ring  = ringRef.current
    const dot   = dotRef.current
    const coord = coordRef.current
    if (!ring || !dot || !coord) return

    gsap.set([ring, dot], { opacity: 0, xPercent: -50, yPercent: -50 })
    gsap.set(coord, { opacity: 0 })

    const onMove = (e: MouseEvent) => {
      if (!isVisible.current) {
        isVisible.current = true
        gsap.to([ring, dot, coord], { opacity: 1, duration: 0.4 })
      }

      // Dot: instant
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0.08, ease: 'none' })
      // Ring: lags
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.55, ease: 'power3.out' })
      // Coord: follows dot, offset bottom-right of cursor centre
      gsap.to(coord, { x: e.clientX + 18, y: e.clientY + 14, duration: 0.08, ease: 'none' })

      // Animate coordinate values counting up to new position
      const nx =  (e.clientX / window.innerWidth)  * 2 - 1
      const ny = -(e.clientY / window.innerHeight) * 2 + 1
      gsap.to(counter.current, {
        x: nx, y: ny,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: true,
        onUpdate: () => {
          if (xValRef.current) xValRef.current.textContent = fmt(counter.current.x)
          if (yValRef.current) yValRef.current.textContent = fmt(counter.current.y)
        },
      })
    }

    const onLeaveWindow = () => {
      if (isVisible.current) gsap.to([ring, dot, coord], { opacity: 0, duration: 0.3 })
      isVisible.current = false
    }
    const onEnterWindow = () => {
      if (isVisible.current) gsap.to([ring, dot, coord], { opacity: 1, duration: 0.3 })
    }

    const onEnterEl   = () => gsap.to(ring, { scale: 1.7, opacity: 0.6, duration: 0.3, ease: 'power2.out' })
    const onLeaveEl   = () => gsap.to(ring, { scale: 1,   opacity: 1,   duration: 0.3, ease: 'power2.out' })
    // 3D fragment / artifact hover — dispatched from canvas components
    const onNodeEnter = () => gsap.to(ring, { scale: 2.1, opacity: 0.45, duration: 0.25, ease: 'power2.out' })
    const onNodeLeave = () => gsap.to(ring, { scale: 1,   opacity: 1,    duration: 0.35, ease: 'power2.out' })

    window.addEventListener('mousemove',  onMove,       { passive: true })
    window.addEventListener('mouseleave', onLeaveWindow)
    window.addEventListener('mouseenter', onEnterWindow)
    document.addEventListener('cursor:node-enter', onNodeEnter)
    document.addEventListener('cursor:node-leave', onNodeLeave)

    const interactables = document.querySelectorAll('a, button, [data-cursor]')
    interactables.forEach(el => {
      el.addEventListener('mouseenter', onEnterEl)
      el.addEventListener('mouseleave', onLeaveEl)
    })

    return () => {
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('mouseleave', onLeaveWindow)
      window.removeEventListener('mouseenter', onEnterWindow)
      document.removeEventListener('cursor:node-enter', onNodeEnter)
      document.removeEventListener('cursor:node-leave', onNodeLeave)
      interactables.forEach(el => {
        el.removeEventListener('mouseenter', onEnterEl)
        el.removeEventListener('mouseleave', onLeaveEl)
      })
    }
  }, [])

  if (IS_TOUCH) return null
  return (
    <>
      {/* Lagging outer ring */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: 38, height: 38,
          border: '1px solid rgba(74, 158, 255, 0.55)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          mixBlendMode: 'screen',
          willChange: 'transform',
        }}
      />

      {/* Instant centre dot */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: 4, height: 4,
          background: 'rgba(190, 215, 255, 0.9)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          willChange: 'transform',
        }}
      />

      {/* Coordinate readout */}
      <div
        ref={coordRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.18rem',
          willChange: 'transform',
        }}
      >
        <div style={lineStyle}>
          <span style={labelStyle}>X</span>
          <span ref={xValRef} style={valStyle}>+0.000</span>
        </div>
        <div style={lineStyle}>
          <span style={labelStyle}>Y</span>
          <span ref={yValRef} style={valStyle}>+0.000</span>
        </div>
      </div>
    </>
  )
}

const lineStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.35rem',
  alignItems: 'baseline',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  letterSpacing: '0.08em',
  color: 'rgba(74, 158, 255, 0.85)',
  userSelect: 'none',
}

const valStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.84rem',
  letterSpacing: '0.04em',
  color: 'rgba(180, 215, 255, 1.0)',
  userSelect: 'none',
}
