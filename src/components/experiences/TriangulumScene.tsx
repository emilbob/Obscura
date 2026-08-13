import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleImageToParticles } from './sampleImage'
import { useGalaxyMouse } from './useGalaxyMouse'
import { framingScale } from '../../lib/framing'
import imgUrl from '../../assets/triangulum.jpg'

const VS = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aBright;
  attribute float aPhase;
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

    float r0      = max(0.001, length(position.xz));
    float phi0    = atan(position.z, position.x);
    float spinT   = max(0.0, uTime - uSpinDelay);
    float phi     = phi0 + spinT * uRotSpeed;

    float breathe = sin(uTime * 0.28 + aPhase * 6.2832) * 0.022;
    float r1      = r0 * (1.0 + breathe);

    vec3 p = vec3(r1 * cos(phi), position.y, r1 * sin(phi));

    float mDist  = length(p.xz - uMouseWorld.xz);
    float mForce = smoothstep(uMouseRadius, 0.0, mDist);
    vec2  mDir   = mDist > 0.001 ? normalize(p.xz - uMouseWorld.xz) : vec2(1.0, 0.0);
    p.x += mDir.x * mForce * uMouseRadius * 0.65;
    p.z += mDir.y * mForce * uMouseRadius * 0.65;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position  = projectionMatrix * mv;
    gl_PointSize = (aSize + aBright * 4.0) * (22.0 / -mv.z);

    float f1       = sin(uTime * 0.55 + aPhase * 6.2832);
    float f2       = sin(uTime * 1.12 + aPhase * 3.1416);
    float flicker  = 0.70 + 0.30 * max(0.0, f1) + 0.08 * max(0.0, f2);
    float loss     = step(0.96, sin(uTime * 0.18 + aPhase * 12.566));
    float edgeFade = 1.0 - smoothstep(4.0, 6.5, r0);
    float base     = mix(0.62, 1.0, aBright);
    vAlpha = base * flicker * (1.0 - loss * 0.55) * max(0.15, edgeFade) * uReveal;
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
    float sH     = exp(-abs(uv.y)*65.0) * exp(-uv.x*uv.x*28.0);
    float sV     = exp(-abs(uv.x)*65.0) * exp(-uv.y*uv.y*28.0);
    float spikes = (sH + sV) * vBright * 0.22;
    float alpha  = (core + spikes) * vAlpha;
    vec3  col    = vColor;
    col = mix(col, uColorHot, vBright * core * 0.42);
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
    float r0  = max(0.001, length(position.xz));
    float phi = atan(position.z, position.x) + max(0.0, uTime - uSpinDelay) * uRotSpeed;
    vec3  p   = vec3(r0*cos(phi), position.y, r0*sin(phi));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const LINE_FS = /* glsl */`
  uniform float uTime;
  uniform float uReveal;
  uniform vec3  uLineColor;
  varying float vPhase;
  void main() {
    float slow = sin(uTime * 0.28 + vPhase * 6.2832) * 0.5 + 0.5;
    float loss = step(0.92, sin(uTime * 0.12 + vPhase * 4.0));
    gl_FragColor = vec4(uLineColor, slow * (1.0-loss) * uReveal * 0.12);
  }
`

function buildLines(N: number): THREE.BufferGeometry {
  const pos    = new Float32Array(N * 2 * 3)
  const phases = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    const th  = Math.random() * Math.PI * 2
    const r   = 0.25 + Math.random() * 2.2
    const len = 0.06 + Math.random() * 0.26
    const dir = th + (Math.random()-0.5) * Math.PI * 0.55
    pos[i*6+0]=r*Math.cos(th); pos[i*6+1]=(Math.random()-0.5)*0.05; pos[i*6+2]=r*Math.sin(th)
    pos[i*6+3]=pos[i*6+0]+Math.cos(dir)*len; pos[i*6+4]=pos[i*6+1]; pos[i*6+5]=pos[i*6+2]+Math.sin(dir)*len
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
  return g
}

export default function TriangulumScene() {
  const { targetRef, smoothRef } = useGalaxyMouse()
  const starMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineMatRef = useRef<THREE.ShaderMaterial>(null)
  const lineGeo    = useMemo(() => buildLines(18), [])
  const geoRef     = useRef<THREE.BufferGeometry | null>(null)
  const [starGeo, setStarGeo] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    let cancelled = false
    sampleImageToParticles(imgUrl, 65000, { scale: 3.8, yJitter: 0.10 }).then(data => {
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
    const r = Math.min(1, t / 7.0)
    smoothRef.current.lerp(targetRef.current, 0.10)
    if (starMatRef.current) {
      starMatRef.current.uniforms.uTime.value   = t
      starMatRef.current.uniforms.uReveal.value = r
      starMatRef.current.uniforms.uMouseWorld.value.copy(smoothRef.current)
    }
    if (lineMatRef.current) { lineMatRef.current.uniforms.uTime.value = t; lineMatRef.current.uniforms.uReveal.value = r }
  })

  const SU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.008}, uSpinDelay:{value:8.5},
    uColorHot:{value:new THREE.Color(0.96, 0.98, 1.00)},
    uMouseWorld:{value:new THREE.Vector3(9999,0,9999)}, uMouseRadius:{value:0.9},
  }), [])

  const LU = useMemo(() => ({
    uTime:{value:0}, uReveal:{value:0}, uRotSpeed:{value:0.008}, uSpinDelay:{value:8.5},
    uLineColor:{value:new THREE.Color(0.75, 0.85, 1.00)},
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
  useFrame(({ camera, clock, size }) => {
    const t = clock.getElapsedTime()
    camera.position.x = Math.sin(t * 0.018) * 0.55
    camera.position.y = 0.10 + Math.cos(t * 0.014) * 0.14
    camera.position.z = 5.40 + Math.sin(t * 0.022) * 0.28
    camera.position.multiplyScalar(framingScale(size.width / size.height))
    camera.lookAt(Math.sin(t*0.012)*0.08, 0, 0)
  })
  return null
}
