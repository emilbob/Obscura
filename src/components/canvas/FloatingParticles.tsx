import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMousePosition } from '../../hooks/useMousePosition'

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aSpeed;
  attribute float aOffset;
  attribute float aAmplitude;

  uniform float uTime;
  uniform vec3 uMouseWorld;
  uniform float uReveal;

  void main() {
    vec3 pos = position;

    // Organic, slow Lissajous-style drift
    float t = uTime * aSpeed + aOffset;
    pos.x += sin(t * 1.10 + aOffset) * aAmplitude;
    pos.y += cos(t * 0.73 + aOffset * 2.1) * aAmplitude * 0.85;
    pos.z += sin(t * 0.91 + aOffset * 3.7) * aAmplitude * 0.4;

    // World-space mouse repulsion
    vec2 toMouse = pos.xy - uMouseWorld.xy;
    float mDist = length(toMouse);
    float mRadius = 2.8;
    if (mDist < mRadius && mDist > 0.001) {
      float strength = (1.0 - mDist / mRadius);
      strength = strength * strength * 1.8;
      pos.xy += normalize(toMouse) * strength;
    }

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float pointSize = aSize * (180.0 / -mvPos.z);
    gl_PointSize = min(pointSize * uReveal, 8.0);
    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uReveal;

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);
    if (dist > 0.5) discard;

    float alpha = (1.0 - smoothstep(0.15, 0.5, dist)) * 0.45 * uReveal;
    vec3 color = vec3(0.65, 0.78, 1.00);
    gl_FragColor = vec4(color, alpha);
  }
`

interface FloatingParticlesProps {
  revealRef:   React.MutableRefObject<number>
  silenceRef?: React.MutableRefObject<number>
}

// Scratch vectors — allocated once, reused every frame
const _vec = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _worldPos = new THREE.Vector3()

export default function FloatingParticles({ revealRef, silenceRef }: FloatingParticlesProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const mouse = useMousePosition()
  const { camera } = useThree()

  const geometry = useMemo(() => {
    const count = 2200
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const speeds = new Float32Array(count)
    const offsets = new Float32Array(count)
    const amplitudes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Loose cloud, denser toward the signal source at center
      const r = Math.pow(Math.random(), 0.6) * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7 + 0.2
      positions[i * 3 + 2] = r * Math.cos(phi) - 2

      sizes[i]      = 0.6 + Math.random() * 1.4
      speeds[i]     = 0.05 + Math.random() * 0.12
      offsets[i]    = Math.random() * Math.PI * 2
      amplitudes[i] = 0.1 + Math.random() * 0.35
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position',   new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize',      new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aSpeed',     new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aOffset',    new THREE.BufferAttribute(offsets, 1))
    geo.setAttribute('aAmplitude', new THREE.BufferAttribute(amplitudes, 1))
    return geo
  }, [])

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uMouseWorld: { value: new THREE.Vector3() },
    uReveal:     { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return

    const silence = silenceRef ? silenceRef.current : 0
    matRef.current.uniforms.uTime.value   = clock.getElapsedTime() * (1.0 - silence * 0.72)
    matRef.current.uniforms.uReveal.value = revealRef.current * (1.0 - silence * 0.92)

    // Unproject mouse onto z=0 world plane (no allocations)
    _vec.set(mouse.current.x, mouse.current.y, 0.5).unproject(camera)
    _dir.copy(_vec).sub(camera.position).normalize()
    const dist = -camera.position.z / _dir.z
    _worldPos.copy(camera.position).addScaledVector(_dir, dist)

    const mw = matRef.current.uniforms.uMouseWorld.value as THREE.Vector3
    mw.x += (_worldPos.x - mw.x) * 0.08
    mw.y += (_worldPos.y - mw.y) * 0.08
    mw.z = _worldPos.z
  })

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
