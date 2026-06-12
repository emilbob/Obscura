import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Ring definitions ─────────────────────────────────────────────────────────
// Each ring has a fixed tilt (rotX, rotZ) and a spin speed around its own Z axis

interface RingDef {
  radius:  number
  tube:    number
  rotX:    number
  rotZ:    number
  speed:   number   // rad / s — spin around ring's own axis
  delay:   number   // ch3Progress threshold to start revealing
  color:   [number, number, number]
}

const RINGS: RingDef[] = [
  { radius: 3.40, tube: 0.018, rotX: 0,               rotZ: 0,              speed:  0.024, delay: 0.00, color: [0.82, 0.62, 0.24] },
  { radius: 2.65, tube: 0.015, rotX: Math.PI * 0.33,  rotZ: Math.PI / 6,    speed: -0.038, delay: 0.12, color: [0.75, 0.58, 0.28] },
  { radius: 2.05, tube: 0.020, rotX: Math.PI / 2,     rotZ: 0,              speed:  0.055, delay: 0.22, color: [0.80, 0.62, 0.22] },
  { radius: 1.45, tube: 0.023, rotX: Math.PI * 0.67,  rotZ: Math.PI / 3,    speed: -0.042, delay: 0.34, color: [0.88, 0.70, 0.20] },
  { radius: 0.88, tube: 0.028, rotX: Math.PI / 4,     rotZ: Math.PI * 0.62, speed:  0.085, delay: 0.46, color: [0.96, 0.80, 0.28] },
]

// ─── Shader ───────────────────────────────────────────────────────────────────

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
    // Shimmer travelling around ring circumference (vUv.y = position round the big circle)
    float shimmer = 0.5 + 0.5 * sin(vUv.y * 18.85 - uTime * 0.55); // 18.85 ≈ 6π

    // Fresnel: highlight edges of the thin tube
    vec3  viewDir = normalize(-vViewPos);
    float fresnel = 1.0 - abs(dot(normalize(vViewNormal), viewDir));
    fresnel = pow(fresnel, 1.4);

    // Color: warm gold base, cooled by shimmer & edge glow
    vec3 color = uColor;
    color = mix(color, vec3(0.50, 0.78, 1.0), shimmer * 0.22 + fresnel * 0.38);

    float alpha = clamp((0.55 + shimmer * 0.28 + fresnel * 0.28) * uReveal, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`

// ─── Component ────────────────────────────────────────────────────────────────

interface ObservatoryRingsProps {
  progressRef: React.MutableRefObject<number>
}

export default function ObservatoryRings({ progressRef }: ObservatoryRingsProps) {
  // One ref per spinning mesh
  const spinRefs = useRef<(THREE.Mesh | null)[]>(Array(RINGS.length).fill(null))

  const { geometries, materials } = useMemo(() => {
    const geometries = RINGS.map(r =>
      new THREE.TorusGeometry(r.radius, r.tube, 5, 160)
    )
    const materials = RINGS.map(r =>
      new THREE.ShaderMaterial({
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime:   { value: 0 },
          uReveal: { value: 0 },
          uColor:  { value: new THREE.Color(...r.color) },
        },
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
        side:        THREE.DoubleSide,
      })
    )
    return { geometries, materials }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = progressRef.current

    RINGS.forEach((ring, i) => {
      const mesh = spinRefs.current[i]
      if (mesh) {
        // Spin around the torus's own symmetry axis (local Z = the axis through the ring's centre)
        mesh.rotation.z = t * ring.speed
      }

      // Staggered reveal
      const reveal = Math.max(0, Math.min(1, (p - ring.delay) / 0.22))
      materials[i].uniforms.uReveal.value = reveal
      materials[i].uniforms.uTime.value   = t
    })
  })

  return (
    // All rings centred on the signal source
    <group position={[0, 0.3, -4]}>
      {RINGS.map((ring, i) => (
        // Outer group holds the static tilt
        <group key={i} rotation={[ring.rotX, 0, ring.rotZ]}>
          {/* Inner mesh spins around its own Z axis */}
          <mesh
            ref={el => { spinRefs.current[i] = el }}
            geometry={geometries[i]}
            material={materials[i]}
          />
        </group>
      ))}
    </group>
  )
}
