import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleImageToParticles } from './sampleImage'
import { useGalaxyMouse } from './useGalaxyMouse'
import imgUrl from '../../assets/andromeda.webp'

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

    float r0    = max(0.001, length(position.xz));
    float phi0  = atan(position.z, position.x);
    float spinT = max(0.0, uTime - uSpinDelay);
    float omega = uRotSpeed * (1.0 + 0.70 / (r0 + 0.10));
    float phi   = phi0 + spinT * omega;
    vec3 p      = vec3(r0 * cos(phi), position.y, r0 * sin(phi));

    float mDist  = length(p.xz - uMouseWorld.xz);
    float mForce = smoothstep(uMouseRadius, 0.0, mDist);
    vec2  mDir   = mDist > 0.001 ? normalize(p.xz - uMouseWorld.xz) : vec2(1.0, 0.0);
    p.x += mDir.x * mForce * uMouseRadius * 0.65;
    p.z += mDir.y * mForce * uMouseRadius * 0.65;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position  = projectionMatrix * mv;
    gl_PointSize = (aSize + aBright * 4.0) * (20.0 / -mv.z);

    float edgeFade = 1.0 - smoothstep(4.5, 7.0, r0);
    float twinkle  = 0.85 + 0.15 * sin(uTime * 2.6 + aPhase * 6.2832);
    float base     = mix(0.55, 1.0, aBright);
    float imgX     = 1.0 - smoothstep(3.0, 4.2, abs(position.x));
    float imgZ     = 1.0 - smoothstep(1.7, 2.4, abs(position.z));
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
    float spikes = (sH + sV) * vBright * 0.30;
    float alpha  = (core + spikes) * vAlpha;
    vec3  col    = vColor;
    col = mix(col, uColorHot, vBright * core * 0.60);
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
    float r0    = max(0.001, length(position.xz));
    float phi0  = atan(position.z, position.x);
    float spinT = max(0.0, uTime - uSpinDelay);
    float omega = uRotSpeed * (1.0 + 0.70 / (r0 + 0.10));
    float phi   = phi0 + spinT * omega;
    vec3 p      = vec3(r0 * cos(phi), position.y, r0 * sin(phi));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const LINE_FS = /* glsl */`
  uniform float uTime;
  uniform float uReveal;
  uniform vec3  uLineColor;
  varying float vPhase;
  void main() {
    float p = 0.20 + 0.80 * sin(uTime * 1.8 + vPhase * 6.2832);
    gl_FragColor = vec4(uLineColor, max(0.0, p) * uReveal * 0.20);
  }
`

function buildLines(N: number): THREE.BufferGeometry {
  const pos    = new Float32Array(N * 2 * 3)
  const phases = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    const arm  = i % 2
    const base = (arm / 2) * Math.PI * 2
    const t    = 0.08 + Math.random()*0.80
    const r    = 0.16 + t*2.85
    const ang  = base + t*Math.PI*3.8
    const tang = ang + Math.PI*0.5
    const len  = 0.04 + Math.random()*0.16
    pos[i*6+0]=r*Math.cos(ang); pos[i*6+1]=0; pos[i*6+2]=r*Math.sin(ang)
    pos[i*6+3]=r*Math.cos(ang)+Math.cos(tang)*len; pos[i*6+4]=0; pos[i*6+5]=r*Math.sin(ang)+Math.sin(tang)*len
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

export default function AndromedaScene() {
  const { targetRef, smoothRef } = useGalaxyMouse()
  const starMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineGeo    = useMemo(() => buildLines(120), [])
  const geoRef     = useRef<THREE.BufferGeometry | null>(null)
  const [starGeo, setStarGeo] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    let cancelled = false
    sampleImageToParticles(imgUrl, 70000, { scale: 4.2, yJitter: 0.09 }).then(data => {
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
    const r = Math.min(1, t / 4.5)
    smoothRef.current.lerp(targetRef.current, 0.10)
    if (starMatRef.current) {
      starMatRef.current.uniforms.uTime.value    = t
      starMatRef.current.uniforms.uReveal.value  = r
      starMatRef.current.uniforms.uMouseWorld.value.copy(smoothRef.current)
    }
    if (lineMatRef.current) { lineMatRef.current.uniforms.uTime.value = t; lineMatRef.current.uniforms.uReveal.value = r }
  })

  const SU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.048}, uSpinDelay:{value:6.0},
    uColorHot:{value:new THREE.Color(0.82,0.88,1.00)},
    uMouseWorld:{value:new THREE.Vector3(9999,0,9999)}, uMouseRadius:{value:0.9},
  }), [])

  const LU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.048}, uSpinDelay:{value:6.0},
    uLineColor:{value:new THREE.Color(0.35,0.55,1.00)},
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
    const orbit = t * 0.105
    const dist  = 7.0 + Math.sin(t * 0.070) * 0.90
    camera.position.x = Math.cos(orbit) * dist
    camera.position.y = 3.0 + Math.sin(t * 0.042) * 0.60
    camera.position.z = Math.sin(orbit) * dist
    camera.lookAt(0, 0, 0)
  })
  return null
}
