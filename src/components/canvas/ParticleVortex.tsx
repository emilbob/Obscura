import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Geometry (built once at module level) ─────────────────────────────────────
// Particles distributed in a disc around the iris center.
// Actual positions are computed per-frame in the vertex shader;
// the JS position attribute is just a required placeholder.

const COUNT = 2200

function buildVortexGeo(): THREE.BufferGeometry {
  const pos    = new Float32Array(COUNT * 3)
  const aAngle = new Float32Array(COUNT)
  const aR     = new Float32Array(COUNT)
  const aY     = new Float32Array(COUNT)
  const aSpeed = new Float32Array(COUNT)

  // Seeded deterministic layout — no Math.random() to keep stable across hot-reloads
  // (simple LCG is enough for visual distribution)
  let seed = 42
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }

  for (let i = 0; i < COUNT; i++) {
    const r     = 0.8 + Math.pow(rand(), 0.6) * 7.0
    const angle = rand() * Math.PI * 2
    const y     = (rand() - 0.5) * 5.5
    const speed = 0.4 + rand() * 1.2

    aAngle[i] = angle
    aR[i]     = r
    aY[i]     = y
    aSpeed[i] = speed

    // Initial placeholder positions on their orbits
    pos[i*3]   = r * Math.cos(angle)
    pos[i*3+1] = y
    pos[i*3+2] = -4 + r * Math.sin(angle)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aAngle',   new THREE.BufferAttribute(aAngle, 1))
  geo.setAttribute('aR',       new THREE.BufferAttribute(aR,     1))
  geo.setAttribute('aY',       new THREE.BufferAttribute(aY,     1))
  geo.setAttribute('aSpeed',   new THREE.BufferAttribute(aSpeed, 1))
  return geo
}

const VORTEX_GEO = buildVortexGeo()

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  attribute float aAngle;
  attribute float aR;
  attribute float aY;
  attribute float aSpeed;

  uniform float uTime;
  uniform float uSpin;    // 0→1, angular speed multiplier grows with ch4
  uniform float uPull;    // 0→1, particles pulled toward iris centre
  uniform float uReveal;

  varying float vBright;

  void main() {
    float angle = aAngle + uTime * aSpeed * (0.5 + uSpin * 3.5);

    // Radius and height collapse toward iris centre as uPull increases
    float r = aR * (1.0 - uPull * 0.80);
    float y = aY * (1.0 - uPull * 0.65) + 0.3;

    vec3 pos = vec3(r * cos(angle), y, -4.0 + r * sin(angle));

    vBright = uReveal * (0.25 + uSpin * 0.30 + uPull * 0.45);

    vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
    gl_Position   = projectionMatrix * mvPos;
    gl_PointSize  = clamp(1.5 + uSpin * 2.5 + uPull * 4.0, 1.0, 9.0);
  }
`

const FRAG = /* glsl */ `
  varying float vBright;

  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float r  = length(uv) * 2.0;
    if (r > 1.0) discard;
    float soft  = 1.0 - smoothstep(0.35, 1.0, r);
    vec3  color = mix(vec3(0.45, 0.72, 1.0), vec3(1.0, 1.0, 1.0), vBright * 0.55);
    gl_FragColor = vec4(color, soft * vBright * 0.70);
  }
`

// ── Component ─────────────────────────────────────────────────────────────────

interface ParticleVortexProps {
  progressRef: React.MutableRefObject<number>
  calmedRef?:  React.MutableRefObject<number>   // ch5 progress — disperses vortex
}

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

export default function ParticleVortex({ progressRef, calmedRef }: ParticleVortexProps) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime:   { value: 0 },
      uSpin:   { value: 0 },
      uPull:   { value: 0 },
      uReveal: { value: 0 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }), [])

  useFrame(({ clock }) => {
    const p = progressRef.current
    const t = clock.getElapsedTime()

    const calmed = calmedRef?.current ?? 0

    mat.uniforms.uTime.value   = t
    mat.uniforms.uReveal.value = ss(c1(p / 0.38)) * (1 - calmed)
    mat.uniforms.uSpin.value   = ss(c1(p / 0.85)) * (1 - calmed * 0.7)
    mat.uniforms.uPull.value   = ss(c1((p - 0.28) / 0.60)) * (1 - calmed)
  })

  // frustumCulled=false because shader overrides position attribute
  return <points geometry={VORTEX_GEO} material={mat} frustumCulled={false} />
}
