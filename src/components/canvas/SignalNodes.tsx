import { useRef, useMemo, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { gsap } from 'gsap'

// ── Node positions ────────────────────────────────────────────────────────────
// Hand-placed to feel naturally distributed across the visible space

const NODE_POS: [number, number, number][] = [
  [-2.5,  1.8, -2.0],
  [ 2.8,  0.5, -3.0],
  [-1.2, -1.5, -1.5],
  [ 0.5,  2.8, -2.5],
  [ 3.2, -1.5, -2.0],
  [-3.5,  0.2, -3.0],
  [ 1.5,  3.2, -3.5],
  [-0.5, -2.8, -2.0],
  [ 3.8,  2.0, -4.0],
  [-2.0,  3.5, -4.0],
]

const NODE_VECS = NODE_POS.map(p => new THREE.Vector3(...p))

// ── Pre-compute connections ───────────────────────────────────────────────────

const MAX_DIST = 4.5
const EDGES: [number, number][] = []
for (let i = 0; i < NODE_VECS.length; i++) {
  for (let j = i + 1; j < NODE_VECS.length; j++) {
    if (NODE_VECS[i].distanceTo(NODE_VECS[j]) < MAX_DIST) EDGES.push([i, j])
  }
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const SPHERE_GEO = new THREE.SphereGeometry(0.10, 16, 16)
const CLICK_GEO  = new THREE.SphereGeometry(0.35,  8,  8)  // larger invisible click target
const PULSE_GEO  = new THREE.TorusGeometry(1, 0.018, 4, 64)

function buildEdgeGeo(i: number, j: number): THREE.BufferGeometry {
  const a = NODE_VECS[i], b = NODE_VECS[j]
  const N = 40
  const pos = new Float32Array((N + 1) * 3)
  const aT  = new Float32Array(N + 1)
  for (let k = 0; k <= N; k++) {
    const t = k / N
    pos[k*3]   = a.x + (b.x - a.x) * t
    pos[k*3+1] = a.y + (b.y - a.y) * t
    pos[k*3+2] = a.z + (b.z - a.z) * t
    aT[k] = t
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT',       new THREE.BufferAttribute(aT,  1))
  return geo
}

const EDGE_GEOS = EDGES.map(([i, j]) => buildEdgeGeo(i, j))

// ── Shaders ───────────────────────────────────────────────────────────────────

const NODE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vNormal     = normalize(normalMatrix * normal);
    vViewPos    = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const NODE_FRAG = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  uniform float uTime;
  uniform float uHover;
  uniform float uActive;
  uniform float uReveal;

  void main() {
    vec3  viewDir = normalize(-vViewPos);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 1.6);
    float pulse   = 0.55 + 0.45 * sin(uTime * (2.2 + uHover * 3.0 + uActive * 1.5));

    // Idle: cool blue-white. Activated: warm gold.
    vec3 color = mix(vec3(0.52, 0.78, 1.0), vec3(1.0, 0.90, 0.55), uActive);

    float glow = fresnel * (0.7 + pulse * 0.3) + 0.14 * pulse
               + uActive * 0.40 + uHover * 0.28;

    gl_FragColor = vec4(color, uReveal * clamp(glow, 0.0, 1.0));
  }
`

const EDGE_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT          = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const EDGE_FRAG = /* glsl */ `
  varying float vT;
  uniform float uProgress;
  uniform float uAlpha;
  uniform float uWarm;

  void main() {
    if (vT > uProgress) discard;
    float tip = 1.0 - smoothstep(uProgress - 0.12, uProgress, vT);
    vec3 color = mix(vec3(0.35, 0.65, 1.0), vec3(1.0, 0.85, 0.38), uWarm);
    gl_FragColor = vec4(color, uAlpha * (0.50 + tip * 0.50));
  }
`

// ── Component ─────────────────────────────────────────────────────────────────

const POOL = 5  // reusable pulse rings

interface SignalNodesProps {
  onActivate:     (count: number) => void
  starsRevealRef: React.MutableRefObject<number>
}

export default function SignalNodes({ onActivate, starsRevealRef }: SignalNodesProps) {
  const activated   = useRef<boolean[]>(Array(NODE_POS.length).fill(false))
  const totalActive = useRef(0)
  const poolCursor  = useRef(0)

  // ── Materials ──────────────────────────────────────────────────────────────

  const nodeMats = useMemo(() => NODE_POS.map(() => new THREE.ShaderMaterial({
    vertexShader:   NODE_VERT,
    fragmentShader: NODE_FRAG,
    uniforms: { uTime:{value:0}, uHover:{value:0}, uActive:{value:0}, uReveal:{value:0} },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })), [])

  const edgeMats = useMemo(() => EDGES.map(() => new THREE.ShaderMaterial({
    vertexShader:   EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    uniforms: { uProgress:{value:0}, uAlpha:{value:0}, uWarm:{value:0} },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })), [])

  const pulseMats = useMemo(() => Array.from({length: POOL}, () =>
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.45, 0.78, 1.0),
      transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  ), [])

  // Pre-build edge line objects so <primitive> renders correctly
  const edgeLines = useMemo(() =>
    EDGE_GEOS.map((geo, i) => new THREE.Line(geo, edgeMats[i])),
  [edgeMats])

  const pulseRefs = useRef<(THREE.Mesh | null)[]>(Array(POOL).fill(null))
  const invisMat  = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), [])

  // ── Click handler ──────────────────────────────────────────────────────────

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>, idx: number) => {
    e.stopPropagation()
    if (activated.current[idx]) return

    activated.current[idx] = true
    totalActive.current++
    onActivate(totalActive.current)

    // Node flashes gold
    gsap.to(nodeMats[idx].uniforms.uActive, { value: 1, duration: 0.55, ease: 'power2.out' })

    // Pulse ring from pool
    const pi  = poolCursor.current % POOL
    poolCursor.current++
    const mesh = pulseRefs.current[pi]
    const pMat = pulseMats[pi]
    if (mesh) {
      mesh.position.set(...NODE_POS[idx])
      mesh.scale.setScalar(0.05)
      gsap.killTweensOf([mesh.scale, pMat])
      pMat.opacity = 0.90
      gsap.to(mesh.scale, { x: 3.0, y: 3.0, z: 3.0, duration: 2.0, ease: 'power2.out' })
      gsap.to(pMat, { opacity: 0, duration: 2.0, ease: 'power2.in', delay: 0.1 })
    }

    // Animate connected edges
    EDGES.forEach(([a, b], ei) => {
      if (a !== idx && b !== idx) return
      const em = edgeMats[ei]
      em.uniforms.uWarm.value = (activated.current[a] && activated.current[b]) ? 1 : 0
      gsap.killTweensOf([em.uniforms.uProgress, em.uniforms.uAlpha])
      gsap.set(em.uniforms.uProgress, { value: 0 })
      gsap.set(em.uniforms.uAlpha,    { value: 1 })
      gsap.to(em.uniforms.uProgress, { value: 1, duration: 0.65, ease: 'power2.inOut' })
      gsap.to(em.uniforms.uAlpha,    { value: 0, duration: 1.0, delay: 3.5, ease: 'power2.in' })
    })
  }, [nodeMats, edgeMats, pulseMats, onActivate])

  // ── Frame update ───────────────────────────────────────────────────────────

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime()
    const rv = Math.min(1, starsRevealRef.current)
    nodeMats.forEach(m => {
      m.uniforms.uTime.value   = t
      m.uniforms.uReveal.value = rv
    })
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Glowing nodes with large invisible click targets */}
      {NODE_POS.map((pos, i) => (
        <group key={`node-${i}`} position={pos}>
          {/* Visual sphere */}
          <mesh geometry={SPHERE_GEO} material={nodeMats[i]} />
          {/* Invisible larger hit area */}
          <mesh
            geometry={CLICK_GEO}
            material={invisMat}
            onClick={(e) => handleClick(e, i)}
            onPointerEnter={() => {
              gsap.to(nodeMats[i].uniforms.uHover, { value: 1, duration: 0.25 })
              document.dispatchEvent(new CustomEvent('cursor:node-enter'))
            }}
            onPointerLeave={() => {
              if (!activated.current[i])
                gsap.to(nodeMats[i].uniforms.uHover, { value: 0, duration: 0.5 })
              document.dispatchEvent(new CustomEvent('cursor:node-leave'))
            }}
          />
        </group>
      ))}

      {/* Connection edges */}
      {edgeLines.map((line, i) => (
        <primitive key={`edge-${i}`} object={line} />
      ))}

      {/* Pulse ring pool — parked off-screen until activated */}
      {pulseMats.map((mat, i) => (
        <mesh
          key={`pulse-${i}`}
          ref={el => { pulseRefs.current[i] = el }}
          geometry={PULSE_GEO}
          material={mat}
          position={[0, -9999, 0]}
        />
      ))}
    </>
  )
}
