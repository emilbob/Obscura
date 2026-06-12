import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Constellation data ───────────────────────────────────────────────────────

type StarPos  = [number, number, number]
type Edge     = [number, number]

interface Constellation {
  stars: StarPos[]
  edges: Edge[]
}

const CONSTELLATIONS: Constellation[] = [
  {
    // "The Receiver" — left
    stars: [
      [-4.0,  1.6, -2.8],
      [-2.8,  3.0, -3.2],
      [-2.2,  1.4, -3.5],
      [-3.5,  0.0, -2.4],
      [-5.0,  0.6, -3.1],
      [-3.2, -1.4, -3.0],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[0,4],[3,5]],
  },
  {
    // "The Array" — right
    stars: [
      [ 3.0,  2.4, -2.8],
      [ 4.5,  1.0, -2.5],
      [ 3.2, -0.4, -3.2],
      [ 5.0, -0.8, -1.8],
      [ 3.8, -1.8, -2.6],
      [ 2.4,  0.4, -3.5],
    ],
    edges: [[0,1],[1,2],[2,5],[5,0],[1,3],[3,4]],
  },
  {
    // "The Crown" — upper centre
    stars: [
      [-1.6,  4.0, -3.5],
      [ 0.0,  4.8, -4.0],
      [ 1.6,  3.8, -3.2],
      [ 0.5,  2.6, -2.8],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0]],
  },
]

// ─── Shaders ─────────────────────────────────────────────────────────────────

const STAR_VERT = /* glsl */ `
  uniform float uReveal;
  uniform float uTime;
  varying float vPhase;

  void main() {
    vPhase = position.x * 3.7 + position.z * 2.1;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 6.5 * uReveal;
    gl_Position = projectionMatrix * mvPos;
  }
`

const STAR_FRAG = /* glsl */ `
  uniform float uReveal;
  uniform float uTime;
  varying float vPhase;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    float core  = 1.0 - smoothstep(0.0, 0.18, d);
    float glow  = 1.0 - smoothstep(0.0, 0.5,  d);
    float blink = 0.88 + 0.12 * sin(uTime * 1.8 + vPhase);

    float alpha = (core * 1.0 + glow * 0.55) * uReveal * blink;
    vec3  color = vec3(0.58, 0.82, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`

const LINE_VERT = /* glsl */ `
  attribute float aT;
  varying   float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const LINE_FRAG = /* glsl */ `
  varying float vT;
  uniform float uProgress; // 0 → 1 for this line
  uniform float uReveal;   // global fade

  void main() {
    // Soft leading edge
    float drawn = 1.0 - smoothstep(uProgress - 0.06, uProgress + 0.001, vT);
    if (drawn < 0.01) discard;

    // Line fades slightly toward destination
    float trail = 0.68 - vT * 0.22;
    float alpha  = drawn * trail * uReveal;

    vec3 color = vec3(0.28, 0.58, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`

// ─── Build edge data (once, outside component) ────────────────────────────────

interface EdgeData {
  geometry:       THREE.BufferGeometry
  progressOffset: number  // 0..1 — when this line starts drawing
}

function buildAllEdges(): EdgeData[] {
  const allEdges: EdgeData[] = []
  let index = 0

  CONSTELLATIONS.forEach(({ stars, edges }) => {
    edges.forEach(([a, b]) => {
      const sa = stars[a], sb = stars[b]
      const positions = new Float32Array([sa[0],sa[1],sa[2], sb[0],sb[1],sb[2]])
      const ts        = new Float32Array([0, 1])

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('aT',       new THREE.BufferAttribute(ts, 1))

      allEdges.push({ geometry: geo, progressOffset: index })
      index++
    })
  })

  // Normalise offsets: spread evenly from 0 to 0.82
  const total = allEdges.length
  allEdges.forEach((e, i) => { e.progressOffset = (i / (total - 1)) * 0.82 })

  return allEdges
}

const EDGE_DATA = buildAllEdges()

// ─── Star point geometry (all constellation vertices) ─────────────────────────

function buildStarGeometry(): THREE.BufferGeometry {
  const pts: number[] = []
  CONSTELLATIONS.forEach(({ stars }) => stars.forEach(s => pts.push(...s)))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
  return geo
}

const STAR_GEOMETRY = buildStarGeometry()

// ─── Component ────────────────────────────────────────────────────────────────

interface ConstellationLinesProps {
  progressRef: React.MutableRefObject<number>
}

export default function ConstellationLines({ progressRef }: ConstellationLinesProps) {
  const starMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineMatRefs = useRef<THREE.ShaderMaterial[]>([])

  // Create line materials (one per edge, each owns a uProgress uniform)
  const lineMaterials = useMemo(() =>
    EDGE_DATA.map(() => new THREE.ShaderMaterial({
      vertexShader:   LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: {
        uProgress: { value: 0 },
        uReveal:   { value: 0 },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    })), [])

  const starUniforms = useMemo(() => ({
    uReveal: { value: 0 },
    uTime:   { value: 0 },
  }), [])

  // Store refs
  useEffect(() => {
    lineMatRefs.current = lineMaterials
  }, [lineMaterials])

  useFrame(({ clock }) => {
    const p = progressRef.current

    // Stars fade in
    if (starMatRef.current) {
      starMatRef.current.uniforms.uReveal.value = Math.min(p * 3.0, 1.0)
      starMatRef.current.uniforms.uTime.value   = clock.getElapsedTime()
    }

    // Lines draw themselves in sequence
    lineMaterials.forEach((mat, i) => {
      const offset      = EDGE_DATA[i].progressOffset
      const lineReveal  = Math.max(0, Math.min(1, (p - offset) / 0.18))
      mat.uniforms.uProgress.value = lineReveal
      mat.uniforms.uReveal.value   = Math.min(p * 2.0, 1.0)
    })
  })

  return (
    <group>
      {/* Constellation star points */}
      <points geometry={STAR_GEOMETRY}>
        <shaderMaterial
          ref={starMatRef}
          vertexShader={STAR_VERT}
          fragmentShader={STAR_FRAG}
          uniforms={starUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* One line per edge */}
      {EDGE_DATA.map((edge, i) => (
        <primitive
          key={i}
          object={new THREE.Line(edge.geometry, lineMaterials[i])}
        />
      ))}
    </group>
  )
}
