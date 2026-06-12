import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Spiral geometry (module level) ───────────────────────────────────────────
// Logarithmic spiral: r = MIN_R * e^(B * theta)
// 3 arms × 1200 particles + 500 haze = 4100 total

const ARMS       = 3
const PER_ARM    = 1200
const HAZE       = 500
const TOTAL      = ARMS * PER_ARM + HAZE
const B          = 0.30          // spiral tightness
const MIN_R      = 0.08          // inner radius
const MAX_THETA  = Math.PI * 4   // 2 rotations per arm
const MAX_R      = MIN_R * Math.exp(B * MAX_THETA)  // ≈ 3.47

function buildFormationGeo(): THREE.BufferGeometry {
  const pos    = new Float32Array(TOTAL * 3)
  const aR     = new Float32Array(TOTAL)    // 0 (centre) → 1 (edge), for color + reveal
  const aPhase = new Float32Array(TOTAL)    // reveal order: centre particles appear first

  let seed = 1337
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }

  let idx = 0

  for (let arm = 0; arm < ARMS; arm++) {
    const armAngle = (arm / ARMS) * Math.PI * 2

    for (let j = 0; j < PER_ARM; j++) {
      const t     = j / PER_ARM
      const theta = t * MAX_THETA
      const r     = MIN_R * Math.exp(B * theta)
      const nr    = r / MAX_R                        // 0→1 normalised

      // Angular + radial scatter (more scatter toward edges)
      const angScatter = (rand() - 0.5) * 0.22 * nr
      const radScatter = (rand() - 0.5) * r * 0.14

      const angle   = theta + armAngle + angScatter
      const effectR = Math.max(0, r + radScatter)

      pos[idx*3]   = effectR * Math.cos(angle)
      pos[idx*3+1] = effectR * Math.sin(angle)
      pos[idx*3+2] = (rand() - 0.5) * 0.10 * (1 - nr * 0.6) // disc: thinner at edges

      aR[idx]     = nr
      aPhase[idx] = nr   // centre (nr≈0) assembles first
      idx++
    }
  }

  // Scattered haze across the whole disc
  for (let j = 0; j < HAZE; j++) {
    const r     = MAX_R * Math.sqrt(rand())   // uniform radial distribution
    const angle = rand() * Math.PI * 2
    pos[idx*3]   = r * Math.cos(angle)
    pos[idx*3+1] = r * Math.sin(angle)
    pos[idx*3+2] = (rand() - 0.5) * 0.25
    aR[idx]     = r / MAX_R
    aPhase[idx] = r / MAX_R
    idx++
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aR',       new THREE.BufferAttribute(aR,     1))
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(aPhase, 1))
  return geo
}

const FORMATION_GEO = buildFormationGeo()

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  attribute float aR;
  attribute float aPhase;

  uniform float uReveal;
  uniform float uTime;

  varying float vR;
  varying float vAlpha;

  void main() {
    vR = aR;

    // Centre-outward assembly: particles appear in order of distance from centre
    float appear = smoothstep(aPhase - 0.10, aPhase + 0.06, uReveal);

    // Gentle breathing twinkle
    float twinkle = 0.82 + 0.18 * sin(uTime * 1.2 + aPhase * 52.8);

    vAlpha = appear * twinkle;

    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Larger, more luminous near centre
    gl_PointSize = mix(3.8, 1.2, aR) * appear;
  }
`

const FRAG = /* glsl */ `
  varying float vR;
  varying float vAlpha;

  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float r  = length(uv) * 2.0;
    if (r > 1.0) discard;
    float soft = 1.0 - smoothstep(0.28, 1.0, r);

    // Warm gold (centre) → ice blue (edge) gradient
    vec3 goldColor = vec3(0.98, 0.86, 0.52);
    vec3 midColor  = vec3(0.62, 0.80, 1.00);
    vec3 edgeColor = vec3(0.28, 0.50, 0.90);

    vec3 color;
    if (vR < 0.40) {
      color = mix(goldColor, midColor,  vR / 0.40);
    } else {
      color = mix(midColor,  edgeColor, (vR - 0.40) / 0.60);
    }

    float alpha = soft * vAlpha * mix(0.92, 0.38, vR);
    gl_FragColor = vec4(color, alpha);
  }
`

// ── Component ─────────────────────────────────────────────────────────────────

interface CelestialFormationProps {
  progressRef: React.MutableRefObject<number>
}

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

export default function CelestialFormation({ progressRef }: CelestialFormationProps) {
  const groupRef = useRef<THREE.Group>(null)

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uReveal: { value: 0 },
      uTime:   { value: 0 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }), [])

  useFrame(({ clock }) => {
    const p = progressRef.current
    const t = clock.getElapsedTime()

    mat.uniforms.uReveal.value = ss(c1((p - 0.10) / 0.70))
    mat.uniforms.uTime.value   = t

    // Slow, peaceful rotation
    if (groupRef.current) groupRef.current.rotation.z = t * 0.009
  })

  return (
    // Centred on the signal source / iris
    <group ref={groupRef} position={[0, 0.3, -4]}>
      <points geometry={FORMATION_GEO} material={mat} frustumCulled={false} />
    </group>
  )
}
