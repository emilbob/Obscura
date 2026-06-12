import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Beam definitions ─────────────────────────────────────────────────────────
// Each beam is a thin plane that rotates into its aligned angle as ch3 advances

interface BeamDef {
  targetZ:  number   // final rotation around Z (rad)
  offsetZ:  number   // initial angular offset (misaligned) — will ease to 0
  revealAt: number   // ch3Progress when this beam begins appearing
}

const BEAMS: BeamDef[] = [
  { targetZ:  0,              offsetZ: -0.55, revealAt: 0.28 }, // horizontal
  { targetZ:  Math.PI / 2,    offsetZ:  0.62, revealAt: 0.34 }, // vertical
  { targetZ:  Math.PI / 4,    offsetZ: -0.48, revealAt: 0.41 }, // diagonal ↗
  { targetZ: -Math.PI / 4,    offsetZ:  0.40, revealAt: 0.48 }, // diagonal ↘
]

// ─── Shaders ─────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uReveal;
  uniform float uAlign; // 0 → 1 as beam approaches aligned position

  void main() {
    // Width: bright along central axis, fade to 0 at edges
    float uDist     = abs(vUv.x - 0.5) * 2.0;
    float widthFade = pow(1.0 - uDist, 2.8);

    // Length: fades toward both ends; extra glow at signal crossing (v = 0.5)
    float vDist     = abs(vUv.y - 0.5) * 2.0;
    float lenFade   = 1.0 - smoothstep(0.0, 1.0, vDist);
    lenFade = pow(lenFade, 0.55);

    // Hot spot at the exact centre where all beams cross
    float crossGlow = (1.0 - smoothstep(0.0, 0.18, uDist)) * (1.0 - smoothstep(0.0, 0.12, vDist));
    crossGlow = pow(crossGlow, 0.7);

    float alpha = (widthFade * lenFade * 0.28 + crossGlow * 0.35) * uReveal;

    // Colour shifts warmer when fully aligned
    vec3 baseColor  = vec3(0.30, 0.60, 1.0);
    vec3 alignColor = vec3(0.65, 0.88, 1.0);
    vec3 color      = mix(baseColor, alignColor, uAlign * 0.55 + crossGlow * 0.45);

    gl_FragColor = vec4(color, alpha);
  }
`

// Shared geometry: thin plane 0.07 × 14 units
const BEAM_GEO = new THREE.PlaneGeometry(0.07, 14, 1, 1)

// ─── Component ────────────────────────────────────────────────────────────────

interface LightBeamsProps {
  progressRef: React.MutableRefObject<number>
  calmedRef?: React.MutableRefObject<number>
}

export default function LightBeams({ progressRef, calmedRef }: LightBeamsProps) {
  const groupRefs = useRef<(THREE.Group | null)[]>(Array(BEAMS.length).fill(null))

  const materials = useMemo(() =>
    BEAMS.map(() => new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms: {
        uReveal: { value: 0 },
        uAlign:  { value: 0 },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    })), [])

  useFrame(() => {
    const p      = progressRef.current
    const calmed = calmedRef?.current ?? 0

    BEAMS.forEach((beam, i) => {
      const group = groupRefs.current[i]
      if (!group) return

      const raw    = Math.max(0, Math.min(1, (p - beam.revealAt) / 0.38))
      const smooth = raw * raw * (3 - 2 * raw)
      const reveal = Math.max(0, Math.min(1, (p - beam.revealAt) / 0.18))

      group.rotation.z = beam.targetZ + beam.offsetZ * (1 - smooth)

      materials[i].uniforms.uReveal.value = reveal * (1 - calmed)
      materials[i].uniforms.uAlign.value  = smooth
    })
  })

  return (
    // Centred on signal position, slightly in front of rings
    <group position={[0, 0.3, -3.6]}>
      {BEAMS.map((_, i) => (
        <group key={i} ref={el => { groupRefs.current[i] = el }}>
          <mesh geometry={BEAM_GEO} material={materials[i]} />
        </group>
      ))}
    </group>
  )
}
