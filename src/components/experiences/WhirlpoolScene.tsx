import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleImageToParticles } from './sampleImage'
import { useGalaxyMouse } from './useGalaxyMouse'
import imgUrl from '../public/whirlpoll.jpg'

const VS = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aBright;
  attribute float aPhase;
  attribute float aStorm;
  varying  vec3   vColor;
  varying  float  vAlpha;
  varying  float  vBright;
  uniform  float  uTime;
  uniform  float  uReveal;
  uniform  float  uRotSpeed;
  uniform  float  uSpinDelay;
  uniform  vec3   uMouseWorld;
  uniform  float  uMouseRadius;

  void main() {
    vColor  = aColor;
    vBright = aBright;

    float spinT = max(0.0, uTime - uSpinDelay);
    float r0    = max(0.001, length(position.xz));
    float pulse = sin(spinT * 0.65 + aPhase * 6.2832) * 0.5 + 0.5;
    float drift = aStorm * pulse * 0.45;
    vec2  dir   = normalize(position.xz);
    vec3  pp    = vec3(position.x + dir.x*drift, position.y, position.z + dir.y*drift);

    float r1    = max(0.001, length(pp.xz));
    float phi0  = atan(pp.z, pp.x);
    float omega = uRotSpeed * (1.0 + 0.80 / (r1 + 0.08));
    float phi   = phi0 + spinT * omega;
    vec3 p      = vec3(r1 * cos(phi), pp.y, r1 * sin(phi));

    float mDist  = length(p.xz - uMouseWorld.xz);
    float mForce = smoothstep(uMouseRadius, 0.0, mDist);
    vec2  mDir   = mDist > 0.001 ? normalize(p.xz - uMouseWorld.xz) : vec2(1.0, 0.0);
    p.x += mDir.x * mForce * uMouseRadius * 0.65;
    p.z += mDir.y * mForce * uMouseRadius * 0.65;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position  = projectionMatrix * mv;
    gl_PointSize = (aSize + aBright * 4.0) * (20.0 / -mv.z);

    float edgeFade = 1.0 - smoothstep(3.8, 6.5, r0);
    float twinkle  = 0.82 + 0.18 * sin(uTime * 3.5 + aPhase * 6.2832);
    float base     = mix(0.55, 1.0, aBright);
    vAlpha = base * max(0.12, edgeFade) * twinkle * uReveal;
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
    float omega = uRotSpeed * (1.0 + 0.80 / (r0 + 0.08));
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
    float p = 0.15 + 0.85 * sin(uTime * 2.8 + vPhase * 6.2832);
    gl_FragColor = vec4(uLineColor, max(0.0, p) * uReveal * 0.22);
  }
`

function buildLines(N: number): THREE.BufferGeometry {
  const pos    = new Float32Array(N * 2 * 3)
  const phases = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    const th     = Math.random() * Math.PI * 2
    const r0     = 0.08 + Math.random() * 1.75
    const rLen   = 0.05 + Math.random() * 0.24
    const outAng = Math.random() < 0.65 ? th : th + Math.PI * 0.5
    pos[i*6+0]=r0*Math.cos(th); pos[i*6+1]=0; pos[i*6+2]=r0*Math.sin(th)
    pos[i*6+3]=pos[i*6+0]+Math.cos(outAng)*rLen; pos[i*6+4]=0; pos[i*6+5]=pos[i*6+2]+Math.sin(outAng)*rLen
    const ph = Math.random(); phases[i*2]=ph; phases[i*2+1]=ph
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos,    3))
  g.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1))
  return g
}

function buildGeoFromData(d: Awaited<ReturnType<typeof sampleImageToParticles>>): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(d.pos,    3))
  g.setAttribute('aSize',    new THREE.BufferAttribute(d.sizes,  1))
  g.setAttribute('aColor',   new THREE.BufferAttribute(d.colors, 3))
  g.setAttribute('aBright',  new THREE.BufferAttribute(d.bright, 1))
  g.setAttribute('aPhase',   new THREE.BufferAttribute(d.phases, 1))
  g.setAttribute('aStorm',   new THREE.BufferAttribute(d.storms, 1))
  return g
}

export default function WhirlpoolScene() {
  const { targetRef, smoothRef } = useGalaxyMouse()
  const starMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineGeo    = useMemo(() => buildLines(150), [])
  const geoRef     = useRef<THREE.BufferGeometry | null>(null)
  const [starGeo, setStarGeo] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    let cancelled = false
    sampleImageToParticles(imgUrl, 90000, { scale: 4.0, yJitter: 0.07, stormFraction: 0.22 }).then(data => {
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
    const r = Math.min(1, t / 3.5)
    smoothRef.current.lerp(targetRef.current, 0.10)
    if (starMatRef.current) {
      starMatRef.current.uniforms.uTime.value   = t
      starMatRef.current.uniforms.uReveal.value = r
      starMatRef.current.uniforms.uMouseWorld.value.copy(smoothRef.current)
    }
    if (lineMatRef.current) { lineMatRef.current.uniforms.uTime.value = t; lineMatRef.current.uniforms.uReveal.value = r }
  })

  const SU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.16}, uSpinDelay:{value:0},
    uColorHot:{value:new THREE.Color(1.00,1.00,1.00)},
    uMouseWorld:{value:new THREE.Vector3(9999,0,9999)}, uMouseRadius:{value:0.9},
  }), [])

  const LU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.16}, uSpinDelay:{value:0},
    uLineColor:{value:new THREE.Color(0.18,0.88,1.00)},
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
    const orbit = t * 0.095
    const dist  = 3.6 + Math.sin(t * 0.060) * 1.10
    const shk   = 0.028
    camera.position.x = Math.cos(orbit) * dist + Math.sin(t*0.72)*shk
    camera.position.y = 2.40 + Math.sin(t * 0.090) * 0.55
    camera.position.z = Math.sin(orbit) * dist + Math.sin(t*1.30)*shk
    camera.lookAt(Math.sin(t*0.45)*0.05, 0, 0)
  })
  return null
}
