import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import StarField from './StarField'
import SignalPulse from './SignalPulse'
import FloatingParticles from './FloatingParticles'
import ConstellationLines from './ConstellationLines'
import NetworkNodes from './NetworkNodes'
import ApertureIris from './ApertureIris'
import LightBeams from './LightBeams'
import EnergyConduits from './EnergyConduits'
import ParticleVortex from './ParticleVortex'
import OrbitalHalo from './OrbitalHalo'
import TelescopeRing from './TelescopeRing'
import CelestialFormation from './CelestialFormation'
import Effects from './Effects'
import CameraRig from './CameraRig'

interface SceneProps {
  scrollRef: React.MutableRefObject<number>
  startRef:  React.MutableRefObject<(() => void) | null>
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

// ── Scroll bands (2000vh, ch1–ch6 occupy first 1700vh = 0–0.85) ───────────────
// Bands are the old 1700vh fractions × 0.85
// Ch1 Signal:          0.000 – 0.085
// Ch2 Mapping:         0.085 – 0.281
// Ch3 The Archive:     0.264 – 0.443
// Ch4 The Collection:  0.425 – 0.553
// Ch5 Reorientation:   0.544 – 0.697
// Ch6 Alignment:       0.680 – 0.850
// Ch7 Silence:         0.850 – 1.000

export default function Scene({ scrollRef, startRef }: SceneProps) {
  const starsRevealRef     = useRef(0)
  const signalOpacityRef   = useRef(0)
  const particlesRevealRef = useRef(0)
  const ch2ProgressRef     = useRef(0)
  const ch3ProgressRef     = useRef(0)
  const ch4ProgressRef     = useRef(0)
  const ch5ProgressRef     = useRef(0)  // Reorientation
  const ch6ProgressRef     = useRef(0)  // Alignment
  const ch7ProgressRef     = useRef(0)  // Silence

  useFrame(() => {
    const s = scrollRef.current
    ch2ProgressRef.current = clamp01((s - 0.085) / 0.196)
    ch3ProgressRef.current = clamp01((s - 0.264) / 0.179)
    ch4ProgressRef.current = clamp01((s - 0.425) / 0.128)
    ch5ProgressRef.current = clamp01((s - 0.544) / 0.153)
    ch6ProgressRef.current = clamp01((s - 0.680) / 0.170)
    ch7ProgressRef.current = clamp01((s - 0.850) / 0.150)
  })

  useEffect(() => {
    let tl: gsap.core.Timeline | null = null
    startRef.current = () => {
      tl = gsap.timeline()
      tl.to(starsRevealRef,     { current: 1, duration: 2.8, delay: 0.15, ease: 'power2.inOut' })
        .to(signalOpacityRef,   { current: 1, duration: 2.0, ease: 'power3.out' }, 0.9)
        .to(particlesRevealRef, { current: 1, duration: 2.5, ease: 'power2.out' }, 1.3)
    }
    return () => { tl?.kill() }
  }, [startRef])

  return (
    <>
      <color attach="background" args={['#000002']} />

      {/* Ch 1 — The Signal */}
      <StarField         revealRef={starsRevealRef} reorientRef={ch5ProgressRef} silenceRef={ch7ProgressRef} />
      <SignalPulse       opacityRef={signalOpacityRef} calmedRef={ch5ProgressRef} />
      <FloatingParticles revealRef={particlesRevealRef} silenceRef={ch7ProgressRef} />

      {/* Ch 2 — Mapping */}
      <ConstellationLines progressRef={ch2ProgressRef} />
      <NetworkNodes       progressRef={ch2ProgressRef} />

      {/* Ch 3 — The Archive */}
      <ApertureIris progressRef={ch3ProgressRef} calmedRef={ch5ProgressRef} />
      <LightBeams   progressRef={ch3ProgressRef} calmedRef={ch5ProgressRef} />

      {/* Ch 4 — The Collection */}
      <EnergyConduits progressRef={ch4ProgressRef} calmedRef={ch5ProgressRef} />
      <ParticleVortex progressRef={ch4ProgressRef} calmedRef={ch5ProgressRef} />
      <OrbitalHalo    progressRef={ch4ProgressRef} />

      {/* Ch 5 — Reorientation */}
      <TelescopeRing progressRef={ch5ProgressRef} />

      {/* Ch 6 — Alignment */}
      <CelestialFormation progressRef={ch6ProgressRef} />

      <CameraRig scrollRef={scrollRef} />
      <Effects />
    </>
  )
}
