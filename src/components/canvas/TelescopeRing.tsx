import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface TelescopeRingProps {
  progressRef: React.MutableRefObject<number>
}

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

function makeRingGeo(radius: number, segments = 160): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

function makeSegGeo(ax: number, ay: number, bx: number, by: number): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(ax, ay, 0),
    new THREE.Vector3(bx, by, 0),
  ])
}

const BLUE  = new THREE.Color(0.29, 0.62, 1.00)
const LIGHT = new THREE.Color(0.55, 0.80, 1.00)
const WHITE = new THREE.Color(0.82, 0.93, 1.00)

function lineMat(color: THREE.Color, opacity: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

export default function TelescopeRing({ progressRef }: TelescopeRingProps) {
  const groupRef = useRef<THREE.Group>(null)

  const { primitives, mats } = useMemo(() => {
    const mats: THREE.LineBasicMaterial[] = []

    const add = (geo: THREE.BufferGeometry, color: THREE.Color, opacity: number, loop = true) => {
      const mat = lineMat(color, opacity)
      mats.push(mat)
      return loop ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat)
    }

    const R = 3.2
    const sq = R / Math.SQRT2

    const primitives: THREE.Object3D[] = [
      // Outer glow halos (wide, dim)
      add(makeRingGeo(R + 0.25), LIGHT, 0.05),
      add(makeRingGeo(R + 0.12), LIGHT, 0.09),
      add(makeRingGeo(R - 0.12), LIGHT, 0.09),
      // Primary aperture ring (main structural)
      add(makeRingGeo(R),        BLUE,  0.90),
      // Dish concentric rings — scale down toward center
      add(makeRingGeo(2.64), BLUE, 0.26),
      add(makeRingGeo(2.08), BLUE, 0.18),
      add(makeRingGeo(1.52), BLUE, 0.13),
      add(makeRingGeo(0.96), BLUE, 0.09),
      add(makeRingGeo(0.48), BLUE, 0.25),
      // Secondary mirror
      add(makeRingGeo(0.28, 48), WHITE, 0.72),
      add(makeRingGeo(0.16, 32), WHITE, 0.45),
      // Focal lock ring (pulses in at end)
      add(makeRingGeo(0.08, 24), WHITE, 0.00),  // starts invisible
      // Spider arms — cardinal
      add(makeSegGeo(-R, 0, R, 0),    BLUE, 0.16, false),
      add(makeSegGeo(0, -R, 0, R),    BLUE, 0.16, false),
      // Spider arms — diagonal (structural support)
      add(makeSegGeo(-sq, -sq, sq, sq), BLUE, 0.08, false),
      add(makeSegGeo(-sq,  sq, sq, -sq), BLUE, 0.08, false),
      // Outer cross tick marks at cardinal points
      add(makeSegGeo(R - 0.22, 0, R + 0.32, 0),   LIGHT, 0.28, false),
      add(makeSegGeo(-(R - 0.22), 0, -(R + 0.32), 0), LIGHT, 0.28, false),
      add(makeSegGeo(0, R - 0.22, 0, R + 0.32),   LIGHT, 0.28, false),
      add(makeSegGeo(0, -(R - 0.22), 0, -(R + 0.32)), LIGHT, 0.28, false),
    ]

    return { primitives, mats }
  }, [])

  // Store base opacities to scale against masterOpacity
  const baseOpacities = useMemo(() => mats.map(m => m.opacity), [mats])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const p = progressRef.current
    const t = clock.getElapsedTime()

    // Fade in (0.10–0.26), hold, fade out (0.94–1.00)
    const fadeIn  = ss(c1((p - 0.10) / 0.16))
    const fadeOut = 1.0 - ss(c1((p - 0.94) / 0.06))
    const master  = fadeIn * fadeOut

    // Y-rotation: -45° across 0.20–0.88
    // Double-smoothstep gives extreme inertia feel — heavy, slow, mechanical
    const rotRaw = c1((p - 0.20) / 0.68)
    const rotP   = ss(ss(rotRaw))
    // Mechanical tremor: strongest mid-rotation, fades at extremes
    const tremor = (1.0 - Math.abs(rotRaw - 0.5) * 2.0) * Math.sin(t * 9.4) * 0.006
    groupRef.current.rotation.y = -rotP * Math.PI * 0.25 + tremor
    // Subtle nod — telescope has slight mechanical tilt during rotation
    groupRef.current.rotation.x = Math.sin(t * 0.22) * 0.005 + rotP * 0.018

    // Focal lock glow pulses in once rotation completes (p > 0.88)
    const lockGlow = ss(c1((p - 0.88) / 0.08))

    mats.forEach((m, i) => {
      if (i === 11) {
        // Focal lock ring — special case
        m.opacity = lockGlow * master * 0.90
      } else {
        m.opacity = baseOpacities[i] * master
      }
    })
  })

  return (
    <group ref={groupRef} position={[0, -0.35, -0.8]}>
      {primitives.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  )
}
