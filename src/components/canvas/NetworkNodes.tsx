import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const NODE_COUNT      = 180
const CONNECT_RADIUS  = 2.1

// ─── Shaders ─────────────────────────────────────────────────────────────────

const NODE_VERT = /* glsl */ `
  uniform float uReveal;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.8 * uReveal;
    gl_Position  = projectionMatrix * mvPos;
  }
`

const NODE_FRAG = /* glsl */ `
  uniform float uReveal;
  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow  = 1.0 - smoothstep(0.0, 0.5, d);
    float alpha = glow * 0.7 * uReveal;
    gl_FragColor = vec4(0.42, 0.68, 1.0, alpha);
  }
`

const EDGE_VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const EDGE_FRAG = /* glsl */ `
  uniform float uReveal;
  void main() {
    gl_FragColor = vec4(0.22, 0.46, 0.95, 0.16 * uReveal);
  }
`

// ─── Pre-compute geometry (module level — runs once) ─────────────────────────

function buildNetwork() {
  // Node positions: denser near origin, scattered in an ellipsoid
  const nodePos = Array.from({ length: NODE_COUNT }, () => {
    const r     = Math.pow(Math.random(), 0.45) * 6.5
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.62 + 0.25,
      r * Math.cos(phi) - 1.5,
    ] as [number, number, number]
  })

  // Connections
  const edgePositions: number[] = []
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const dx = nodePos[i][0] - nodePos[j][0]
      const dy = nodePos[i][1] - nodePos[j][1]
      const dz = nodePos[i][2] - nodePos[j][2]
      if (Math.sqrt(dx*dx + dy*dy + dz*dz) < CONNECT_RADIUS) {
        edgePositions.push(...nodePos[i], ...nodePos[j])
      }
    }
  }

  const nodeGeo = new THREE.BufferGeometry()
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(nodePos.flat()), 3
  ))

  const edgeGeo = new THREE.BufferGeometry()
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(edgePositions), 3
  ))

  return { nodeGeo, edgeGeo }
}

const { nodeGeo, edgeGeo } = buildNetwork()

// ─── Component ────────────────────────────────────────────────────────────────

interface NetworkNodesProps {
  progressRef: React.MutableRefObject<number>
}

export default function NetworkNodes({ progressRef }: NetworkNodesProps) {
  const nodeMatRef = useRef<THREE.ShaderMaterial>(null)
  const edgeMatRef = useRef<THREE.ShaderMaterial>(null)

  const nodeUniforms = useMemo(() => ({ uReveal: { value: 0 } }), [])
  const edgeUniforms = useMemo(() => ({ uReveal: { value: 0 } }), [])

  useFrame(() => {
    const p = progressRef.current
    // Nodes appear before edges (staggered)
    const nodeReveal = Math.max(0, Math.min(1, (p - 0.0) / 0.5))
    const edgeReveal = Math.max(0, Math.min(1, (p - 0.2) / 0.6))

    if (nodeMatRef.current) nodeMatRef.current.uniforms.uReveal.value = nodeReveal
    if (edgeMatRef.current) edgeMatRef.current.uniforms.uReveal.value = edgeReveal
  })

  return (
    <group>
      {/* Network nodes */}
      <points geometry={nodeGeo}>
        <shaderMaterial
          ref={nodeMatRef}
          vertexShader={NODE_VERT}
          fragmentShader={NODE_FRAG}
          uniforms={nodeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Connections */}
      <lineSegments geometry={edgeGeo}>
        <shaderMaterial
          ref={edgeMatRef}
          vertexShader={EDGE_VERT}
          fragmentShader={EDGE_FRAG}
          uniforms={edgeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  )
}
