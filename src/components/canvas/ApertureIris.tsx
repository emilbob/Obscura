import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Constants ─────────────────────────────────────────────────────────────────

const NUM_BLADES    = 8
const BLADE_PIVOT_R = 2.1    // radius from iris center to each blade's pivot
const BLADE_LENGTH  = 2.85   // blade length: pivot → inner tip
const BLADE_OUTER_W = 0.95   // blade width at pivot end
const BLADE_INNER_W = 0.22   // blade width at inner tip
const OPEN_DELTA    = 0.82   // rad each blade rotates to fully open iris

// ── Blade geometry (trapezoid, pivot at origin, tip at y = -BLADE_LENGTH) ────

function buildBladeGeo(): THREE.BufferGeometry {
  const ho = BLADE_OUTER_W / 2
  const hi = BLADE_INNER_W / 2
  const L  = BLADE_LENGTH
  const pos = new Float32Array([
    -ho,  0,  0,
     ho,  0,  0,
     hi, -L,  0,
    -hi, -L,  0,
  ])
  const uv  = new Float32Array([0,1, 1,1, 1,0, 0,0])
  const idx = new Uint16Array([0,3,2, 0,2,1])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv',       new THREE.BufferAttribute(uv,  2))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

const BLADE_GEO = buildBladeGeo()

// ── Shaders ───────────────────────────────────────────────────────────────────

const BLADE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BLADE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpen;
  uniform float uReveal;

  void main() {
    // Soft edge along width
    float ex       = abs(vUv.x - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.88, 1.0, ex);

    // Machined surface lines along blade length
    float fine   = pow(sin(vUv.y * 180.0) * 0.5 + 0.5, 6.0) * 0.12;
    float coarse = pow(sin(vUv.y *  28.0) * 0.5 + 0.5, 8.0) * 0.20;

    // Anisotropic reflection streak offset from centre
    float refl = pow(max(0.0, 1.0 - abs(vUv.x - 0.27) * 6.5), 2.0) * 0.44;

    // Aperture light bleeds from inner tip when iris opens
    float tipGlow = pow(max(0.0, 1.0 - vUv.y), 3.0) * uOpen;

    vec3 color = vec3(0.13, 0.16, 0.24);
    color += fine + coarse;
    color += refl * vec3(0.32, 0.44, 0.70);
    color  = mix(color, vec3(0.38, 0.72, 1.0), tipGlow * 0.62);

    gl_FragColor = vec4(color, edgeFade * uReveal);
  }
`

const HOUSING_VERT = /* glsl */ `
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

const HOUSING_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  uniform float uReveal;
  uniform float uTime;

  void main() {
    vec3  viewDir = normalize(-vViewPos);
    float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), viewDir)), 2.0);
    float shimmer = pow(sin(vUv.y * 25.13 - uTime * 0.35) * 0.5 + 0.5, 5.0) * 0.28;

    vec3 base = vec3(0.16, 0.20, 0.30);
    base = mix(base, vec3(0.50, 0.68, 1.0), fresnel * 0.55 + shimmer);

    gl_FragColor = vec4(base, uReveal * (0.90 + fresnel * 0.10));
  }
`

const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpen;

  void main() {
    vec2  c     = vUv - 0.5;
    float r     = length(c) * 2.0;
    float glow  = pow(max(0.0, 1.0 - r), 0.55);
    vec3  color = mix(vec3(0.38, 0.74, 1.0), vec3(1.0, 1.0, 1.0),
                      pow(max(0.0, 1.0 - r * 1.5), 3.0));
    gl_FragColor = vec4(color, glow * uOpen * 0.58);
  }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

// ── Component ─────────────────────────────────────────────────────────────────

interface ApertureIrisProps {
  progressRef: React.MutableRefObject<number>
  calmedRef?: React.MutableRefObject<number>
}

export default function ApertureIris({ progressRef, calmedRef }: ApertureIrisProps) {
  const pivotRefs = useRef<(THREE.Group | null)[]>(Array(NUM_BLADES).fill(null))

  const { bladeMats, housingMat, glowMat } = useMemo(() => {
    const bladeMats = Array.from({ length: NUM_BLADES }, () =>
      new THREE.ShaderMaterial({
        vertexShader:   BLADE_VERT,
        fragmentShader: BLADE_FRAG,
        uniforms: { uOpen: { value: 0 }, uReveal: { value: 0 } },
        transparent: true,
        depthWrite:  false,
        depthTest:   true,
        side:        THREE.DoubleSide,
      })
    )

    const housingMat = new THREE.ShaderMaterial({
      vertexShader:   HOUSING_VERT,
      fragmentShader: HOUSING_FRAG,
      uniforms: { uReveal: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite:  true,
      side:        THREE.FrontSide,
    })

    const glowMat = new THREE.ShaderMaterial({
      vertexShader:   GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uOpen: { value: 0 } },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    })

    return { bladeMats, housingMat, glowMat }
  }, [])

  useFrame(({ clock }) => {
    const p      = progressRef.current
    const t      = clock.getElapsedTime()
    const calmed = calmedRef?.current ?? 0
    const fade   = 1 - calmed   // 1 in Ch3/Ch4, eases to 0 in Ch5

    // Iris opens as ch3 advances, then gently closes in Ch5
    const irisOpen = ss(c1(p / 0.70)) * fade

    for (let i = 0; i < NUM_BLADES; i++) {
      const reveal = ss(c1((p - i * 0.03) / 0.28)) * fade
      bladeMats[i].uniforms.uReveal.value = reveal
      bladeMats[i].uniforms.uOpen.value   = irisOpen

      const piv = pivotRefs.current[i]
      if (piv) piv.rotation.z = ss(c1(p / 0.70)) * OPEN_DELTA * fade
    }

    housingMat.uniforms.uReveal.value = ss(c1(p / 0.20)) * fade
    housingMat.uniforms.uTime.value   = t

    glowMat.uniforms.uOpen.value = irisOpen
  })

  return (
    <group position={[0, 0.3, -4]}>
      {/* Aperture glow — renders first, additive behind blades */}
      <mesh renderOrder={0} material={glowMat}>
        <planeGeometry args={[5.0, 5.0]} />
      </mesh>

      {/* 8 iris blades — each pivots around a point on the housing ring */}
      {Array.from({ length: NUM_BLADES }, (_, i) => {
        const baseAngle = (i / NUM_BLADES) * Math.PI * 2
        return (
          <group key={i} rotation={[0, 0, baseAngle]}>
            {/* Pivot group: sits at the ring edge, rotates blade open/closed */}
            <group
              ref={el => { pivotRefs.current[i] = el }}
              position={[0, BLADE_PIVOT_R, 0]}
            >
              <mesh
                geometry={BLADE_GEO}
                material={bladeMats[i]}
                renderOrder={i + 1}
                position={[0, 0, i * 0.004]}
              />
            </group>
          </group>
        )
      })}

      {/* Outer housing ring */}
      <mesh material={housingMat} renderOrder={NUM_BLADES + 2}>
        <torusGeometry args={[BLADE_PIVOT_R + 0.38, 0.22, 10, 80]} />
      </mesh>

      {/* Inner accent ring */}
      <mesh material={housingMat} renderOrder={NUM_BLADES + 2}>
        <torusGeometry args={[BLADE_PIVOT_R - 0.04, 0.048, 6, 64]} />
      </mesh>
    </group>
  )
}
