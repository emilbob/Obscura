import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMousePosition } from '../../hooks/useMousePosition'

interface CameraRigProps {
  scrollRef: React.MutableRefObject<number>
}

function ss(x: number) { return x * x * (3 - 2 * x) }
function c1(x: number) { return Math.max(0, Math.min(1, x)) }

export default function CameraRig({ scrollRef }: CameraRigProps) {
  const mouse     = useMousePosition()
  const targetPos = useRef(new THREE.Vector3(0, 0, 5))
  const targetRot = useRef({ x: 0, y: 0, z: 0 })

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime()
    const s = scrollRef.current

    // ── Chapter progress (bands × 0.85 of 2000vh) ───────────────────────────
    const ch2 = ss(c1((s - 0.085) / 0.196))   // Mapping
    const ch3 = ss(c1((s - 0.264) / 0.179))   // The Archive
    const ch4 = ss(c1((s - 0.425) / 0.128))   // The Collection
    const ch5 = ss(c1((s - 0.544) / 0.153))   // Reorientation
    const ch6 = ss(c1((s - 0.680) / 0.170))   // Alignment
    const ch7 = ss(c1((s - 0.850) / 0.150))   // Silence

    // Mouse weight fades through ch3–ch7
    const mouse_w = Math.max(0, 1.0 - ch3 * 0.35 - ch4 * 0.35 - ch5 * 0.30)

    const driftX = Math.sin(t * 0.06) * 0.10
    const driftY = Math.cos(t * 0.05) * 0.06

    // Ch7 (Silence): camera barely moves — a long, nearly static crane shot
    // Mouse influence fully gone, just a slow breathing drift
    const silenceDrift = ch7 * Math.sin(t * 0.04) * 0.04

    targetPos.current.set(
      driftX + mouse.current.x * 0.18 * mouse_w
        + ch3 * 0.72 - ch4 * 0.38
        - ch5 * 0.55 + ch6 * 0.28
        + silenceDrift,
      driftY + mouse.current.y * 0.12 * mouse_w
        + ch2 * 0.40 - ch3 * 0.20 - ch4 * 0.10
        + ch5 * 0.22 + ch6 * 0.32
        + ch7 * 0.12,
      // Ch7: very slow further pullback — watching from a great distance
      5 - ch2 * 3.2 + ch3 * 0.45 + ch4 * 1.80 + ch5 * 1.40 + ch6 * 0.60 + ch7 * 0.80,
    )

    targetRot.current.x = -mouse.current.y * 0.10 * mouse_w + Math.sin(t * 0.07) * 0.005 * (1 - ch7)
    targetRot.current.y =
      -mouse.current.x * 0.13 * mouse_w
      + Math.cos(t * 0.05) * 0.004
      - ch3 * 0.11 + ch4 * 0.04
      + ch5 * 0.06 - ch6 * 0.08
      - ch7 * 0.04
    targetRot.current.z = ch3 * 0.050 - ch4 * 0.032 + ch5 * 0.015 - ch6 * 0.033 - ch7 * 0.010

    // Lerp nearly stops by ch7 — the observatory is at rest
    const lp = 0.028 - ch3 * 0.008 - ch4 * 0.006 - ch5 * 0.008 - ch6 * 0.004 - ch7 * 0.006

    camera.position.x += (targetPos.current.x - camera.position.x) * lp
    camera.position.y += (targetPos.current.y - camera.position.y) * lp
    camera.position.z += (targetPos.current.z - camera.position.z) * lp

    camera.rotation.x += (targetRot.current.x - camera.rotation.x) * (lp + 0.004)
    camera.rotation.y += (targetRot.current.y - camera.rotation.y) * (lp + 0.004)
    camera.rotation.z += (targetRot.current.z - camera.rotation.z) * lp
  })

  return null
}
