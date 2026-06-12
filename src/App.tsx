import { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Scene from './components/canvas/Scene'
import HeroText from './components/ui/HeroText'
import ChapterLabel from './components/ui/ChapterLabel'
import CustomCursor from './components/ui/CustomCursor'
import ScrollIndicator from './components/ui/ScrollIndicator'
import LoadingScreen from './components/ui/LoadingScreen'
import SignalReceived from './components/ui/SignalReceived'
import ReorientationQuery from './components/ui/ReorientationQuery'
import SilenceChapter from './components/ui/SilenceChapter'
import TopControls from './components/ui/TopControls'
import ChapterIndicator from './components/ui/ChapterIndicator'
import GalaxyExperience from './components/experiences/GalaxyExperience'

const isMobile = window.innerWidth < 768
const isTouch  = window.matchMedia('(pointer: coarse)').matches

// Module-level singleton — lives outside React, unaffected by StrictMode double-mount
const ambience = new Audio('/drone-atmospheric-ambience-betacut-1-01-01.mp3')
ambience.loop   = true
ambience.volume = 0

let ambienceStarted = false

function startAmbience() {
  if (ambienceStarted) return
  ambienceStarted = true
  ambience.play().then(() => {
    gsap.to(ambience, { volume: 0.38, duration: 5.0, ease: 'power2.out' })
  }).catch(() => {
    ambienceStarted = false
  })
}

export default function App() {
  const scrollProgressRef = useRef(0)
  const ch7ProgressRef    = useRef(0)
  const sceneStartRef     = useRef<(() => void) | null>(null)
  const lenisRef          = useRef<Lenis | null>(null)

  const [uiReady,      setUiReady]      = useState(false)
  const [chapter,      setChapter]      = useState(1)
  const [activeGalaxy, setActiveGalaxy] = useState<string | null>(null)
  const heroDelayRef    = useRef(0)
  const chapterDelayRef = useRef(0)
  const scrollDelayRef  = useRef(0)

  useEffect(() => {
    const lenis = new Lenis({ lerp: isTouch ? 0.18 : 0.07, smoothWheel: true })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)

    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        scrollProgressRef.current = self.progress
        const s = self.progress
        ch7ProgressRef.current = Math.max(0, Math.min(1, (s - 0.85) / 0.15))
      },
    })

    return () => {
      lenis.destroy()
      lenisRef.current = null
      gsap.ticker.remove((time) => lenis.raf(time * 1000))
    }
  }, [])

  // ── Chapter detection (7 chapters, 2000vh) ────────────────────────────────
  // Old 1700vh positions × 0.85 for ch1–ch6, ch7 at 85–100%
  useEffect(() => {
    if (!uiReady) return

    ScrollTrigger.create({
      start: '8%',  end: '28%',
      onEnter:     () => setChapter(2),
      onLeaveBack: () => setChapter(1),
    })
    ScrollTrigger.create({
      start: '26%', end: '44%',
      onEnter:     () => setChapter(3),
      onLeaveBack: () => setChapter(2),
    })
    ScrollTrigger.create({
      start: '42%', end: '57%',
      onEnter:     () => setChapter(4),
      onLeaveBack: () => setChapter(3),
    })
    ScrollTrigger.create({
      start: '54%', end: '69%',
      onEnter:     () => setChapter(5),
      onLeaveBack: () => setChapter(4),
    })
    ScrollTrigger.create({
      start: '67%', end: '85%',
      onEnter:     () => setChapter(6),
      onLeaveBack: () => setChapter(5),
    })
    ScrollTrigger.create({
      start: '85%', end: 'max',
      onEnter:     () => setChapter(7),
      onLeaveBack: () => setChapter(6),
    })
  }, [uiReady])

  const handleGalaxySelect = useCallback((id: string) => {
    setActiveGalaxy(id)
  }, [])

  const handleGalaxyReturn = useCallback(() => {
    setActiveGalaxy(null)
  }, [])

  const scrollToTop = useCallback(() => {
    lenisRef.current?.scrollTo(0, { immediate: true })
  }, [])

  const handleLoadingComplete = useCallback(() => {
    sceneStartRef.current?.()
    chapterDelayRef.current = 1.8
    heroDelayRef.current    = 2.6
    scrollDelayRef.current  = 5.8
    startAmbience()
    setUiReady(true)
  }, [])

  return (
    <>
      {/* Three.js canvas */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Canvas
          style={{ width: '100%', height: '100%' }}
          camera={{ position: [0, 0, 5], fov: 58, near: 0.1, far: 2000 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          dpr={[1, isMobile ? 1 : 1.5]}
        >
          <Scene scrollRef={scrollProgressRef} startRef={sceneStartRef} />
        </Canvas>
      </div>

      {/* HTML overlay */}
      {uiReady && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
          <ChapterLabel chapter={chapter} delay={chapterDelayRef.current} />
          <HeroText     delay={heroDelayRef.current} hide={chapter >= 5} />
          <ScrollIndicator delay={scrollDelayRef.current} hide={chapter >= 7} />
          <ReorientationQuery visible={chapter === 5} />
          <SignalReceived visible={chapter === 6} />
          <SilenceChapter progressRef={ch7ProgressRef} visible={chapter === 7} onSelect={handleGalaxySelect} />
          <TopControls onScrollTop={scrollToTop} />
          <ChapterIndicator chapter={chapter} delay={chapterDelayRef.current} />
        </div>
      )}

      {activeGalaxy && (
        <GalaxyExperience galaxy={activeGalaxy} onReturn={handleGalaxyReturn} />
      )}

      <LoadingScreen onComplete={handleLoadingComplete} />

      {/* 2000vh — seven chapters */}
      <div style={{ height: '2000vh' }} aria-hidden />

      <CustomCursor />
    </>
  )
}
