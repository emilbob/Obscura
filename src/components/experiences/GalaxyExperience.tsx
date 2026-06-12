import { useRef, useEffect, lazy, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { gsap } from 'gsap'

const SceneMap = {
  andromeda:  lazy(() => import('./AndromedaScene')),
  sombrero:   lazy(() => import('./SombreroScene')),
  whirlpool:  lazy(() => import('./WhirlpoolScene')),
  triangulum: lazy(() => import('./TriangulumScene')),
}

type GalaxyId = keyof typeof SceneMap

const META: Record<GalaxyId, {
  name:          string
  theme:         string
  distanceValue: number
  text:          string
  bg:            string
}> = {
  andromeda: {
    name:          'ANDROMEDA',
    theme:         'ANCIENT SIGNALS',
    distanceValue: 2537000,
    text:          'Transmissions detected predating human civilization. Signal structure suggests intentional encoding. Decryption in progress.',
    bg:            '#00020c',
  },
  sombrero: {
    name:          'SOMBRERO',
    theme:         'LOST ARCHIVES',
    distanceValue: 29300000,
    text:          'Fragmented observations recovered. Partial records of an observatory network that ceased transmission 4.2 billion years ago.',
    bg:            '#0b0601',
  },
  whirlpool: {
    name:          'WHIRLPOOL',
    theme:         'SIGNAL STORM',
    distanceValue: 23160000,
    text:          'Signal integrity compromised. Source location unstable. Multiple overlapping transmissions detected. Attempting synchronization.',
    bg:            '#00050f',
  },
  triangulum: {
    name:          'TRIANGULUM',
    theme:         'THE QUIET ZONE',
    distanceValue: 2730000,
    text:          'No transmissions detected. Complete signal absence. This region may represent the boundary of all observable communication.',
    bg:            '#010103',
  },
}

interface GalaxyExperienceProps {
  galaxy:   string
  onReturn: () => void
}

export default function GalaxyExperience({ galaxy, onReturn }: GalaxyExperienceProps) {
  const wrapRef     = useRef<HTMLDivElement>(null)
  const charRefs    = useRef<(HTMLSpanElement | null)[]>([])
  const metaRef     = useRef<HTMLDivElement>(null)
  const distRef     = useRef<HTMLSpanElement>(null)
  const bodyRef     = useRef<HTMLDivElement>(null)
  const returnRef   = useRef<HTMLButtonElement>(null)

  const id   = (galaxy in SceneMap ? galaxy : 'andromeda') as GalaxyId
  const meta = META[id]
  const Scene = SceneMap[id]

  useEffect(() => {
    if (!wrapRef.current) return

    // Container snaps to visible — dark bg immediately covers main scene
    gsap.fromTo(wrapRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: 'power1.in' }
    )

    // Return button fades in quickly
    gsap.fromTo(returnRef.current,
      { opacity: 0 },
      { opacity: 0.65, duration: 0.8, delay: 0.5, ease: 'power2.out' }
    )

    // Galaxy name — character slide-up, same cadence as SILENCE heading
    const chars = charRefs.current.filter(Boolean) as HTMLSpanElement[]
    gsap.set(chars, { opacity: 0, y: 20, rotateX: -15 })
    gsap.to(chars, {
      opacity: 1, y: 0, rotateX: 0,
      duration: 1.5,
      stagger: 0.065,
      delay: 1.4,
      ease: 'power3.out',
    })

    // Meta line
    gsap.fromTo(metaRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 1.0, delay: 2.8, ease: 'power2.out' }
    )

    // Distance counter
    const counter = { val: 0 }
    gsap.to(counter, {
      val: meta.distanceValue,
      duration: 2.2,
      delay: 3.0,
      ease: 'power2.out',
      onUpdate: () => {
        if (distRef.current)
          distRef.current.textContent = Math.round(counter.val).toLocaleString()
      },
    })

    // Narrative text
    gsap.fromTo(bodyRef.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.2, delay: 4.0, ease: 'power2.out' }
    )
  }, [])

  const handleReturn = () => {
    gsap.to(wrapRef.current, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.inOut',
      onComplete: onReturn,
    })
  }

  const hoverReturn = (enter: boolean) =>
    gsap.to(returnRef.current, { opacity: enter ? 1 : 0.65, duration: 0.22 })

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: meta.bg,
        opacity: 0,
      }}
    >
      {/* Three.js canvas */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Canvas
          camera={{ position: [0, 3, 5], fov: 55, near: 0.1, far: 500 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* Overlay: name + meta + narrative */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

        {/* Galaxy name — top left, character animation */}
        <div style={{
          position: 'absolute',
          top: '2.8rem',
          left: '3.2rem',
          perspective: '600px',
        }}>
          <h1 style={{
            fontFamily:    'var(--font-display)',
            fontWeight:    300,
            fontSize:      'clamp(2.4rem, 4.8vw, 5.0rem)',
            letterSpacing: '0.46em',
            color:         'rgba(220, 235, 255, 1.0)',
            lineHeight:    1,
            margin:        0,
            display:       'flex',
          }}>
            {meta.name.split('').map((ch, i) => (
              <span
                key={i}
                ref={el => { charRefs.current[i] = el }}
                style={{ display: 'inline-block', opacity: 0 }}
              >
                {ch}
              </span>
            ))}
          </h1>

          <div
            ref={metaRef}
            style={{
              marginTop:     '0.85rem',
              fontFamily:    'var(--font-mono)',
              fontSize:      '0.73rem',
              letterSpacing: '0.25em',
              color:         'rgba(140, 195, 255, 0.82)',
              textTransform: 'uppercase',
              opacity:       0,
            }}
          >
            {meta.theme}&nbsp;&nbsp;·&nbsp;&nbsp;<span ref={distRef}>0</span> LIGHT YEARS
          </div>
        </div>

        {/* Narrative — bottom left */}
        <div
          ref={bodyRef}
          style={{
            position:      'absolute',
            bottom:        '3.8rem',
            left:          '3.2rem',
            maxWidth:      '36rem',
            fontFamily:    'var(--font-display)',
            fontWeight:    300,
            fontSize:      'clamp(0.92rem, 1.5vw, 1.18rem)',
            lineHeight:    1.80,
            letterSpacing: '0.05em',
            color:         'rgba(185, 215, 255, 0.80)',
            opacity:       0,
          }}
        >
          {meta.text}
        </div>
      </div>

      {/* Return button — top right */}
      <button
        ref={returnRef}
        onClick={handleReturn}
        onMouseEnter={() => hoverReturn(true)}
        onMouseLeave={() => hoverReturn(false)}
        style={{
          position:      'absolute',
          top:           '2.8rem',
          right:         '3.2rem',
          background:    'none',
          border:        'none',
          padding:       0,
          cursor:        'pointer',
          fontFamily:    'var(--font-mono)',
          fontSize:      '1.05rem',
          letterSpacing: '0.20em',
          color:         'rgba(180, 215, 255, 0.95)',
          textTransform: 'uppercase',
          opacity:       0,
          zIndex:        10,
          pointerEvents: 'auto',
        }}
        aria-label="Return to observatory"
      >
        ← RETURN
      </button>
    </div>
  )
}
