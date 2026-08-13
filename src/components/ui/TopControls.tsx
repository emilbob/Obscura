import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useViewport } from '../../hooks/useViewport'
import AudioToggle from './AudioToggle'

interface TopControlsProps {
  onScrollTop: () => void
}

export default function TopControls({ onScrollTop }: TopControlsProps) {
  const vp       = useViewport()
  const upRef    = useRef<HTMLButtonElement>(null)
  const brandRef = useRef<HTMLButtonElement>(null)

  // Drive brand visibility directly from scroll position — bypasses React state batching
  useEffect(() => {
    let visible = true

    const handleScroll = () => {
      const progress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
      const shouldShow = progress < 0.07

      if (shouldShow === visible) return
      visible = shouldShow

      gsap.to(brandRef.current, {
        opacity:  shouldShow ? 0.78 : 0,
        duration: shouldShow ? 1.2  : 0.5,
        ease:     shouldShow ? 'power2.out' : 'power2.in',
        overwrite: true,
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!upRef.current) return
    const tl = gsap.to(upRef.current, {
      y: -8,
      duration: 0.9,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    })
    return () => { tl.kill() }
  }, [])

  const hover = (el: HTMLElement | null, enter: boolean) => {
    if (!el) return
    gsap.to(el, { opacity: enter ? 1 : 0.78, duration: 0.25, ease: 'power2.out' })
  }

  const btnBase: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    color: 'rgba(180, 215, 255, 0.95)',
    opacity: 0.78,
    userSelect: 'none',
    pointerEvents: 'auto',
  }

  return (
    <>
      {/* OBSCURA — upper right */}
      <button
        ref={brandRef}
        onClick={() => window.location.reload()}
        onMouseEnter={() => hover(brandRef.current, true)}
        onMouseLeave={() => hover(brandRef.current, false)}
        style={{
          ...btnBase,
          position: 'fixed',
          top: '2.5rem',
          right: 'clamp(1rem, 4vw, 2.8rem)',
          fontSize: 'clamp(1.05rem, 3.5vw, 1.65rem)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          zIndex: 30,
          minHeight: 44,
        }}
        aria-label="Restart experience"
      >
        OBSCURA
      </button>

      {/* ↑ — bottom right */}
      <button
        ref={upRef}
        onClick={onScrollTop}
        onMouseEnter={() => hover(upRef.current, true)}
        onMouseLeave={() => hover(upRef.current, false)}
        style={{
          ...btnBase,
          position: 'fixed',
          // clear of the home indicator / browser bottom bar
          bottom: 'calc(2.5rem + env(safe-area-inset-bottom))',
          right: vp.isMobile ? '1rem' : '2.8rem',
          // fluid 31px (320px viewport) → 38.4px (1440px and up), matching the
          // audio toggle's scale so the two bottom controls stay a pair
          fontSize: 'clamp(31px, calc(28.9px + 0.66vw), 2.4rem)',
          lineHeight: 1,
          zIndex: 30,
          minWidth: 44,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Scroll to top"
      >
        ↑
      </button>

      {/* Ambient audio — bottom left, mirroring the scroll-top control.
          On short viewports the chapter rail reaches far enough down that the
          toggle's 60px box would touch its lowest dots, so it steps inboard. */}
      <AudioToggle
        style={{
          bottom: 'calc(2.5rem + env(safe-area-inset-bottom))',
          left:   vp.isShort ? '4rem' : vp.isMobile ? '0.5rem' : '2.5rem',
        }}
      />
    </>
  )
}
