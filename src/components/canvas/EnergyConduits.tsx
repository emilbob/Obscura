import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Conduit definitions ───────────────────────────────────────────────────────
// 8 curved paths from the edges of the visible space → iris center [0, 0.3, -4]

interface ConduitDef {
  from: [number, number, number]
  via:  [number, number, number]
  speed: number   // base pulse travel speed
  phase: number   // phase offset so pulses stagger visually
  revealAt: number
}

const TARGET = new THREE.Vector3(0, 0.3, -4)

const CONDUITS: ConduitDef[] = [
  { from: [-9.0,  5.0,  3.0], via: [-4.5,  2.5, -0.5], speed: 3.2, phase: 0.00, revealAt: 0.00 },
  { from: [ 9.0,  4.0,  2.0], via: [ 4.5,  2.0, -1.0], speed: 2.8, phase: 1.10, revealAt: 0.06 },
  { from: [-7.0, -4.0,  1.0], via: [-3.5, -1.5, -2.0], speed: 3.6, phase: 2.20, revealAt: 0.10 },
  { from: [ 8.0, -3.0,  0.0], via: [ 4.0, -1.0, -2.0], speed: 3.0, phase: 0.70, revealAt: 0.15 },
  { from: [ 0.0,  9.0, -1.0], via: [ 0.5,  4.0, -2.5], speed: 2.5, phase: 3.10, revealAt: 0.04 },
  { from: [-11.0, 0.5, -2.0], via: [-5.0,  0.5, -3.0], speed: 3.4, phase: 1.80, revealAt: 0.12 },
  { from: [10.0, -1.0, -4.0], via: [ 5.0, -0.5, -4.0], speed: 2.9, phase: 2.70, revealAt: 0.08 },
  { from: [ 1.5, -8.5, -3.0], via: [ 0.8, -3.5, -3.5], speed: 3.1, phase: 0.40, revealAt: 0.18 },
]

const SEGMENTS = 80

// Build spline geometry once per conduit
function buildGeo(c: ConduitDef): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(...c.from),
    new THREE.Vector3(...c.via),
    TARGET.clone(),
  ])
  const pts = curve.getPoints(SEGMENTS)
  const pos = new Float32Array(pts.length * 3)
  const aT  = new Float32Array(pts.length)
  pts.forEach((p, i) => {
    pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z
    aT[i] = i / (pts.length - 1)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT',       new THREE.BufferAttribute(aT,  1))
  return geo
}

const CONDUIT_GEOS = CONDUITS.map(buildGeo)

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  attribute float aT;
  uniform float uTime;
  uniform float uReveal;
  uniform float uSpeed;
  uniform float uPhase;

  varying float vAlpha;
  varying float vPulse;

  void main() {
    // Two overlapping pulses racing down the conduit
    float p1 = pow(sin(aT * 14.0 - uTime * uSpeed + uPhase) * 0.5 + 0.5, 3.0);
    float p2 = pow(sin(aT * 24.0 - uTime * uSpeed * 1.4 + uPhase + 1.57) * 0.5 + 0.5, 5.0);
    vPulse = p1 * 0.65 + p2 * 0.35;

    // Reveal tip sweeps from entry (aT=0) toward iris (aT=1)
    float tipFade = 1.0 - smoothstep(uReveal - 0.10, uReveal, aT);
    float visible = step(aT, uReveal);

    vAlpha = vPulse * tipFade * visible;

    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = mix(1.2, 4.5, vPulse) * tipFade * visible;
  }
`

const FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vPulse;

  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float r  = length(uv) * 2.0;
    if (r > 1.0) discard;
    float soft = 1.0 - smoothstep(0.4, 1.0, r);

    vec3 color = mix(vec3(0.22, 0.50, 1.00), vec3(0.78, 0.92, 1.00), vPulse);
    gl_FragColor = vec4(color, soft * vAlpha * 0.90);
  }
`

// ── Component ─────────────────────────────────────────────────────────────────

interface EnergyConduitsProps {
  progressRef: React.MutableRefObject<number>
  calmedRef?:  React.MutableRefObject<number>   // ch5 progress — fades conduits out
}

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

export default function EnergyConduits({ progressRef, calmedRef }: EnergyConduitsProps) {
  const materials = useMemo(() =>
    CONDUITS.map(c => new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:   { value: 0 },
        uReveal: { value: 0 },
        uSpeed:  { value: c.speed },
        uPhase:  { value: c.phase },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    })),
  [])

  useFrame(({ clock }) => {
    const p = progressRef.current
    const t = clock.getElapsedTime()

    const calmed = calmedRef?.current ?? 0

    CONDUITS.forEach((c, i) => {
      const reveal = ss(c1((p - c.revealAt) / 0.44)) * (1 - calmed)
      materials[i].uniforms.uReveal.value = reveal
      materials[i].uniforms.uTime.value   = t
      materials[i].uniforms.uSpeed.value  = c.speed * (1.0 + p * 1.6)
    })
  })

  return (
    <>
      {CONDUIT_GEOS.map((geo, i) => (
        <points key={i} geometry={geo} material={materials[i]} />
      ))}
    </>
  )
}
