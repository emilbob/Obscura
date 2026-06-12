import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMousePosition } from '../../hooks/useMousePosition'

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute vec3 aColor;

  varying float vBrightness;
  varying vec3 vColor;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uReveal;
  uniform float uReorientAngle;

  void main() {
    vBrightness = aBrightness;
    vColor = aColor;

    vec3 pos = position;

    // Reorientation sweep — rotates the visible sky as the telescope reorients
    // Background stars (large negative z) shift more, giving natural parallax
    float cosA = cos(uReorientAngle);
    float sinA = sin(uReorientAngle);
    float rX = pos.x * cosA - pos.z * sinA;
    float rZ = pos.x * sinA + pos.z * cosA;
    pos.x = rX;
    pos.z = rZ;

    // Depth-aware mouse parallax — near stars shift more
    float depthFactor = 1.0 - clamp((pos.z + 600.0) / 1200.0, 0.0, 1.0);
    pos.x += uMouse.x * depthFactor * 4.0;
    pos.y += uMouse.y * depthFactor * 2.5;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float pointSize = aSize * (350.0 / -mvPos.z);
    gl_PointSize = min(pointSize * uReveal, 64.0);
    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying vec3 vColor;

  uniform float uTime;

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);

    if (dist > 0.5) discard;

    // Soft falloff — brightest at center
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float glow = 1.0 - smoothstep(0.1, 0.5, dist);
    float alpha = core * 0.9 + glow * 0.5;

    // Diffraction spike on bright stars only
    if (vBrightness > 0.75) {
      float spike = vBrightness - 0.75;
      float hSpike = exp(-abs(coord.y) * 60.0) * exp(-abs(coord.x) * 3.0);
      float vSpike = exp(-abs(coord.x) * 60.0) * exp(-abs(coord.y) * 3.0);
      alpha += (hSpike + vSpike) * spike * 0.6;
    }

    // Subtle twinkle — each star has unique phase from brightness hash
    float phase = vBrightness * 47.3 + vColor.r * 13.7;
    float twinkle = 0.88 + 0.12 * sin(uTime * 1.8 + phase);

    gl_FragColor = vec4(vColor, clamp(alpha * vBrightness * twinkle, 0.0, 1.0));
  }
`

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number, k = (n + h * 12) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  return [f(0), f(8), f(4)]
}

function buildStarGeometry(count: number) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const brightnesses = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const tier = Math.random()

    if (tier < 0.05) {
      // Foreground stars — close, dramatic
      positions[i * 3] = (Math.random() - 0.5) * 60
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 + 2
    } else if (tier < 0.25) {
      // Mid-field
      positions[i * 3] = (Math.random() - 0.5) * 220
      positions[i * 3 + 1] = (Math.random() - 0.5) * 220
      positions[i * 3 + 2] = (Math.random() - 0.5) * 180 - 50
    } else {
      // Deep background — vast field
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 200 + Math.random() * 400
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6
      positions[i * 3 + 2] = r * Math.cos(phi) - 100
    }

    sizes[i] = 0.4 + Math.pow(Math.random(), 3) * 2.0
    brightnesses[i] = Math.pow(Math.random(), 1.8) * 0.85 + 0.15

    // Stellar color: O/B blue, A white-blue, F/G yellow-white, K orange
    const roll = Math.random()
    let hue: number, sat: number, lig: number
    if (roll < 0.08) {
      hue = 225; sat = 0.55; lig = 0.88 // O/B blue-hot
    } else if (roll < 0.45) {
      hue = 215; sat = 0.25; lig = 0.92 // A white-blue
    } else if (roll < 0.72) {
      hue = 210; sat = 0.10; lig = 0.95 // A-F near-white
    } else if (roll < 0.88) {
      hue = 45;  sat = 0.18; lig = 0.90 // F/G yellow-white
    } else {
      hue = 25;  sat = 0.45; lig = 0.82 // K orange (rare)
    }

    const [r, g, b] = hslToRgb(hue / 360, sat, lig)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }

  return { positions, sizes, brightnesses, colors }
}

interface StarFieldProps {
  revealRef:    React.MutableRefObject<number>
  reorientRef?: React.MutableRefObject<number>
  silenceRef?:  React.MutableRefObject<number>
}

export default function StarField({ revealRef, reorientRef, silenceRef }: StarFieldProps) {
  const meshRef = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const mouse = useMousePosition()

  const geometry = useMemo(() => {
    const count = 9000
    const { positions, sizes, brightnesses, colors } = buildStarGeometry(count)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  const uniforms = useMemo(() => ({
    uTime:          { value: 0 },
    uMouse:         { value: new THREE.Vector2(0, 0) },
    uReveal:        { value: 0 },
    uReorientAngle: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value   = clock.getElapsedTime()
    const silence = silenceRef ? silenceRef.current : 0
    matRef.current.uniforms.uReveal.value = revealRef.current * (1.0 - silence * 0.88)

    // Reorientation sky drift — smooth angle driven by ch5 progress
    if (reorientRef) {
      const p = reorientRef.current
      const eased = p * p * (3 - 2 * p)  // smoothstep
      matRef.current.uniforms.uReorientAngle.value = eased * 0.38
    }

    const m = matRef.current.uniforms.uMouse.value as THREE.Vector2
    m.x += (mouse.current.x - m.x) * 0.04
    m.y += (mouse.current.y - m.y) * 0.04
  })

  return (
    <points ref={meshRef} geometry={geometry}>
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
