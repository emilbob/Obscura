import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleImageToParticles } from './sampleImage'
import { useGalaxyMouse } from './useGalaxyMouse'
import imgUrl from '../public/sombrero.jpg'

const VS = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aBright;
  attribute float aPhase;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vBright;
  uniform float uTime;
  uniform float uReveal;
  uniform float uRotSpeed;
  uniform float uSpinDelay;
  uniform vec3  uMouseWorld;
  uniform float uMouseRadius;

  void main() {
    vColor  = aColor;
    vBright = aBright;

    float a  = max(0.0, uTime - uSpinDelay) * uRotSpeed;
    float ca = cos(a); float sa = sin(a);
    vec3 p   = vec3(
      position.x*ca - position.z*sa,
      position.y,
      position.x*sa + position.z*ca
    );

    float mDist  = length(p.xz - uMouseWorld.xz);
    float mForce = smoothstep(uMouseRadius, 0.0, mDist);
    vec2  mDir   = mDist > 0.001 ? normalize(p.xz - uMouseWorld.xz) : vec2(1.0, 0.0);
    p.x += mDir.x * mForce * uMouseRadius * 0.65;
    p.z += mDir.y * mForce * uMouseRadius * 0.65;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position  = projectionMatrix * mv;
    gl_PointSize = (aSize + aBright * 4.0) * (20.0 / -mv.z);

    float r        = length(position.xz);
    float edgeFade = 1.0 - smoothstep(4.0, 7.0, r);
    float twinkle  = 0.88 + 0.12 * sin(uTime * 2.0 + aPhase * 6.2832);
    float base     = mix(0.55, 1.0, aBright);
    float imgX     = 1.0 - smoothstep(3.3, 4.5, abs(position.x));
    float imgZ     = 1.0 - smoothstep(1.0, 1.55, abs(position.z));
    vAlpha = base * max(0.12, edgeFade) * min(imgX, imgZ) * twinkle * uReveal;
  }
`

const FS = /* glsl */`
  uniform vec3  uColorHot;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vBright;
  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float d  = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core   = pow(max(0.0, 1.0 - d*1.5), 2.5);
    float sH     = exp(-abs(uv.y)*60.0) * exp(-uv.x*uv.x*26.0);
    float sV     = exp(-abs(uv.x)*60.0) * exp(-uv.y*uv.y*26.0);
    float spikes = (sH + sV) * vBright * 0.28;
    float alpha  = (core + spikes) * vAlpha;
    vec3  col    = vColor;
    col = mix(col, uColorHot, vBright * core * 0.52);
    gl_FragColor = vec4(col, alpha);
  }
`

const LINE_VS = /* glsl */`
  attribute float aPhase;
  varying  float vPhase;
  uniform  float uTime;
  uniform  float uRotSpeed;
  uniform  float uSpinDelay;
  void main() {
    vPhase = aPhase;
    float a  = max(0.0, uTime - uSpinDelay) * uRotSpeed;
    float ca = cos(a); float sa = sin(a);
    vec3 p   = vec3(position.x*ca-position.z*sa, position.y, position.x*sa+position.z*ca);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const LINE_FS = /* glsl */`
  uniform float uTime;
  uniform float uReveal;
  uniform vec3  uLineColor;
  varying float vPhase;
  void main() {
    float p = 0.20 + 0.80 * sin(uTime * 1.1 + vPhase * 6.2832);
    gl_FragColor = vec4(uLineColor, max(0.0, p) * uReveal * 0.16);
  }
`

function buildLines(N: number): THREE.BufferGeometry {
  const pos    = new Float32Array(N * 2 * 3)
  const phases = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    const radial = i < N * 0.5
    if (radial) {
      const th=Math.random()*Math.PI*2, r0=0.6+Math.random()*0.5, r1=r0+0.10+Math.random()*0.28
      pos[i*6+0]=r0*Math.cos(th); pos[i*6+1]=0; pos[i*6+2]=r0*Math.sin(th)
      pos[i*6+3]=r1*Math.cos(th); pos[i*6+4]=0; pos[i*6+5]=r1*Math.sin(th)
    } else {
      const th=Math.random()*Math.PI*2, r=0.9+Math.random()*1.8, arc=0.04+Math.random()*0.12
      pos[i*6+0]=r*Math.cos(th); pos[i*6+1]=0; pos[i*6+2]=r*Math.sin(th)
      pos[i*6+3]=r*Math.cos(th+arc); pos[i*6+4]=0; pos[i*6+5]=r*Math.sin(th+arc)
    }
    const ph=Math.random(); phases[i*2]=ph; phases[i*2+1]=ph
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos,    3))
  g.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1))
  return g
}

function buildGeoFromData(d: Awaited<ReturnType<typeof sampleImageToParticles>>): THREE.BufferGeometry {
  const n = d.pos.length / 3
  let cx = 0, cz = 0
  for (let i = 0; i < n; i++) { cx += d.pos[i*3]; cz += d.pos[i*3+2] }
  cx /= n; cz /= n
  for (let i = 0; i < n; i++) { d.pos[i*3] -= cx; d.pos[i*3+2] -= cz }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(d.pos,    3))
  g.setAttribute('aSize',    new THREE.BufferAttribute(d.sizes,  1))
  g.setAttribute('aColor',   new THREE.BufferAttribute(d.colors, 3))
  g.setAttribute('aBright',  new THREE.BufferAttribute(d.bright, 1))
  g.setAttribute('aPhase',   new THREE.BufferAttribute(d.phases, 1))
  return g
}

export default function SombreroScene() {
  const { targetRef, smoothRef } = useGalaxyMouse()
  const starMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineGeo    = useMemo(() => buildLines(90), [])
  const geoRef     = useRef<THREE.BufferGeometry | null>(null)
  const [starGeo, setStarGeo] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    let cancelled = false
    sampleImageToParticles(imgUrl, 55000, { scale: 4.5, yJitter: 0.025 }).then(data => {
      if (cancelled) return
      const g = buildGeoFromData(data)
      geoRef.current?.dispose()
      geoRef.current = g
      setStarGeo(g)
    })
    return () => {
      cancelled = true
      geoRef.current?.dispose()
    }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const r = Math.min(1, t / 5.0)
    smoothRef.current.lerp(targetRef.current, 0.10)
    if (starMatRef.current) {
      starMatRef.current.uniforms.uTime.value   = t
      starMatRef.current.uniforms.uReveal.value = r
      starMatRef.current.uniforms.uMouseWorld.value.copy(smoothRef.current)
    }
    if (lineMatRef.current) { lineMatRef.current.uniforms.uTime.value = t; lineMatRef.current.uniforms.uReveal.value = r }
  })

  const SU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.022}, uSpinDelay:{value:6.5},
    uColorHot:{value:new THREE.Color(1.00,0.93,0.76)},
    uMouseWorld:{value:new THREE.Vector3(9999,0,9999)}, uMouseRadius:{value:0.9},
  }), [])

  const LU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.022}, uSpinDelay:{value:6.5},
    uLineColor:{value:new THREE.Color(1.00,0.62,0.18)},
  }), [])

  return (
    <>
      {starGeo && (
        <points geometry={starGeo}>
          <shaderMaterial ref={starMatRef} vertexShader={VS} fragmentShader={FS}
            uniforms={SU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}
      <lineSegments geometry={lineGeo}>
        <shaderMaterial ref={lineMatRef} vertexShader={LINE_VS} fragmentShader={LINE_FS}
          uniforms={LU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <CameraRig />
    </>
  )
}

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t     = clock.getElapsedTime()
    const orbit = t * 0.052
    const tilt  = 0.55 + Math.abs(Math.sin(t * 0.048)) * 1.20
    camera.position.x = Math.cos(orbit) * 5.5
    camera.position.y = tilt
    camera.position.z = Math.sin(orbit) * 5.5
    camera.lookAt(0, 0, 0)
  })
  return null
}
