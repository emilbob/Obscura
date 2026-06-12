import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Halo definitions ──────────────────────────────────────────────────────────
// Three enormous torus rings at different orbital planes.
// They emerge from complete darkness — the "large-scale structures" of Ch4.

interface HaloDef {
  radius:   number
  tube:     number
  rotX:     number
  rotZ:     number
  revealAt: number
  color:   [number, number, number]
}

const HALOS: HaloDef[] = [
  { radius: 5.5, tube: 0.042, rotX: Math.PI * 0.14, rotZ: Math.PI * 0.06, revealAt: 0.00, color: [0.30, 0.55, 0.98] },
  { radius: 7.5, tube: 0.032, rotX: Math.PI * 0.42, rotZ: Math.PI * 0.30, revealAt: 0.18, color: [0.22, 0.44, 0.88] },
  { radius: 9.5, tube: 0.024, rotX: Math.PI * 0.60, rotZ: Math.PI * 0.52, revealAt: 0.34, color: [0.16, 0.34, 0.76] },
]

// ── Shader ────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  void main() {
    vUv         = uv;
    vViewNormal = normalize(normalMatrix * normal);
    vViewPos    = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  uniform float uTime;
  uniform float uReveal;
  uniform vec3  uColor;

  void main() {
    // Pulse traveling around the ring circumference (vUv.y = 0→1 around the big circle)
    float pulse = pow(sin(vUv.y * 18.85 - uTime * 0.75) * 0.5 + 0.5, 3.0) * 0.55;

    // Infrequent bright flare points (signal echoes propagating around the ring)
    float flare = pow(sin(vUv.y * 6.28 - uTime * 1.15) * 0.5 + 0.5, 14.0) * 0.65;

    // Fresnel: brighter at glancing angles (edge of the tube)
    vec3  viewDir = normalize(-vViewPos);
    float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), viewDir)), 2.2) * 0.45;

    float brightness = 0.14 + pulse + flare + fresnel;
    vec3  color = mix(uColor, vec3(0.68, 0.86, 1.0), pulse * 0.5 + flare * 0.8);

    gl_FragColor = vec4(color * brightness, uReveal * (0.70 + pulse * 0.30));
  }
`

// ── Geometry (module level) ───────────────────────────────────────────────────

const HALO_GEOS = HALOS.map(h =>
  new THREE.TorusGeometry(h.radius, h.tube, 8, 160)
)

// ── Component ─────────────────────────────────────────────────────────────────

interface OrbitalHaloProps {
  progressRef: React.MutableRefObject<number>
}

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

export default function OrbitalHalo({ progressRef }: OrbitalHaloProps) {
  const materials = useMemo(() =>
    HALOS.map(h => new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:   { value: 0 },
        uReveal: { value: 0 },
        uColor:  { value: new THREE.Color(...h.color) },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    })),
  [])

  useFrame(({ clock }) => {
    const p = progressRef.current
    const t = clock.getElapsedTime()

    HALOS.forEach((h, i) => {
      materials[i].uniforms.uReveal.value = ss(c1((p - h.revealAt) / 0.42))
      materials[i].uniforms.uTime.value   = t
    })
  })

  return (
    // All halos centred on the iris / signal source
    <group position={[0, 0.3, -4]}>
      {HALOS.map((h, i) => (
        <group key={i} rotation={[h.rotX, 0, h.rotZ]}>
          <mesh geometry={HALO_GEOS[i]} material={materials[i]} />
        </group>
      ))}
    </group>
  )
}
