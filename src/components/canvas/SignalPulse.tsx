import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Expanding rings + central glow — the signal from deep space
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;

  // Double-pulse heartbeat pattern
  float heartbeat(float t) {
    float period = 3.2;
    float phase = mod(t, period) / period;
    float p1 = smoothstep(0.00, 0.035, phase) * smoothstep(0.10, 0.065, phase);
    float p2 = smoothstep(0.14, 0.175, phase) * smoothstep(0.24, 0.205, phase);
    return max(p1, p2) * 0.45 + 0.55;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv) * 2.0;

    if (dist > 1.0) discard;

    float beat = heartbeat(uTime);

    // Three rings at different expansion speeds and phases
    float t = uTime * 0.18;
    float r1 = fract(dist - t);
    float r2 = fract(dist - t + 0.33);
    float r3 = fract(dist - t + 0.66);

    float rings =
      smoothstep(0.88, 1.00, r1) * 1.0 +
      smoothstep(0.91, 1.00, r2) * 0.55 +
      smoothstep(0.94, 1.00, r3) * 0.30;

    // Rings fade toward the outer edge
    rings *= smoothstep(1.0, 0.0, dist) * beat;

    // Atmospheric glow halo
    float halo = exp(-dist * 4.5) * 0.6 * beat;

    // Intense core — this is what the bloom latches onto
    float core = exp(-dist * 22.0) * 3.5;

    // Color: deep blue rings → hot cyan core
    vec3 ringColor  = vec3(0.22, 0.55, 1.00);
    vec3 haloColor  = vec3(0.30, 0.70, 1.00);
    vec3 coreColor  = vec3(0.65, 0.90, 1.00);

    float coreWeight = core / (core + 1.0);
    vec3 color = mix(mix(ringColor, haloColor, dist * 0.5), coreColor, coreWeight);

    float total = (rings + halo + core) * uOpacity;
    gl_FragColor = vec4(color, clamp(total, 0.0, 1.0));
  }
`

// Subtle secondary pulse — a fainter echo further out
const echoFragShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv) * 2.0;
    if (dist > 1.0) discard;

    float t = uTime * 0.10 + 0.5;
    float r = fract(dist - t);
    float ring = smoothstep(0.92, 1.00, r) * smoothstep(1.0, 0.0, dist) * 0.25;

    gl_FragColor = vec4(0.2, 0.5, 1.0, ring * uOpacity);
  }
`

interface SignalPulseProps {
  opacityRef: React.MutableRefObject<number>
  calmedRef?: React.MutableRefObject<number>
}

export default function SignalPulse({ opacityRef, calmedRef }: SignalPulseProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const echoMatRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  }), [])

  const echoUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    const t      = clock.getElapsedTime()
    const calmed = calmedRef?.current ?? 0
    const op     = opacityRef.current * (1 - calmed)
    if (matRef.current) {
      matRef.current.uniforms.uTime.value    = t
      matRef.current.uniforms.uOpacity.value = op
    }
    if (echoMatRef.current) {
      echoMatRef.current.uniforms.uTime.value    = t
      echoMatRef.current.uniforms.uOpacity.value = op * 0.5
    }
  })

  return (
    <group position={[0, 0.3, -4]}>
      {/* Main signal plane */}
      <mesh>
        <planeGeometry args={[18, 18]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Echo ring — larger, fainter */}
      <mesh>
        <planeGeometry args={[36, 36]} />
        <shaderMaterial
          ref={echoMatRef}
          vertexShader={vertexShader}
          fragmentShader={echoFragShader}
          uniforms={echoUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
