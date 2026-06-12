import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Camera } from 'three'

// Unprojects the mouse onto the galaxy's XZ plane and smooths the result.
// Returns refs that scenes update each frame via lerp.
export function useGalaxyMouse() {
  const { camera } = useThree()
  const targetRef  = useRef(new THREE.Vector3(9999, 0, 9999))
  const smoothRef  = useRef(new THREE.Vector3(9999, 0, 9999))
  const raycaster  = useRef(new THREE.Raycaster())
  const plane      = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const hitVec     = useRef(new THREE.Vector3())

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const x =  (e.clientX / window.innerWidth)  * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1
      raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera as Camera)
      const hit = raycaster.current.ray.intersectPlane(plane.current, hitVec.current)
      if (hit) targetRef.current.copy(hit)
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [camera])

  return { targetRef, smoothRef }
}
