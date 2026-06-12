import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.18}
        luminanceSmoothing={0.035}
        intensity={2.2}
        mipmapBlur
        radius={0.75}
      />
      <Vignette
        offset={0.25}
        darkness={0.72}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise
        opacity={0.032}
        blendFunction={BlendFunction.ADD}
      />
    </EffectComposer>
  )
}
