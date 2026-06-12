// Samples a galaxy image and returns particle attribute arrays.
// Bright pixels get more particles (weighted random sampling via CDF).

export interface SampledParticleData {
  pos:    Float32Array  // N*3
  sizes:  Float32Array  // N
  colors: Float32Array  // N*3 (gamma-boosted RGB from image)
  bright: Float32Array  // N   (0 = normal, >0 = bright star with diffraction)
  phases: Float32Array  // N
  storms: Float32Array  // N   (Whirlpool only; 0 elsewhere)
}

export async function sampleImageToParticles(
  url: string,
  count: number,
  opts: {
    scale?:          number
    yJitter?:        number
    brightGamma?:    number
    stormFraction?:  number
    minLuminance?:   number
  } = {}
): Promise<SampledParticleData> {
  const {
    scale         = 4.0,
    yJitter       = 0.06,
    brightGamma   = 0.7,   // lower = more even sampling, outer arms get particles
    stormFraction = 0,
    minLuminance  = 0.015, // lower = capture dim outer structure
  } = opts

  const img = new Image()
  img.src = url
  await img.decode()

  const maxDim = 800
  const nat = img.naturalWidth / img.naturalHeight
  let W = img.naturalWidth, H = img.naturalHeight
  if (W > maxDim || H > maxDim) {
    if (W >= H) { W = maxDim; H = Math.round(maxDim / nat) }
    else        { H = maxDim; W = Math.round(maxDim * nat) }
  }

  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.drawImage(img, 0, 0, W, H)
  const px = ctx.getImageData(0, 0, W, H).data

  const D = Math.max(W, H)

  const cands: { x: number; z: number; r: number; g: number; b: number; lum: number }[] = []
  const cumW: number[] = []
  let total = 0

  for (let py = 0; py < H; py++) {
    for (let qx = 0; qx < W; qx++) {
      const i   = (py * W + qx) * 4
      const r   = px[i]   / 255
      const g   = px[i+1] / 255
      const b   = px[i+2] / 255
      const lum = 0.299*r + 0.587*g + 0.114*b
      if (lum < minLuminance) continue
      const w  = Math.pow(lum, brightGamma)
      total += w
      cands.push({
        x:   (qx - W*0.5) / D * (scale * 2),
        z: -((py - H*0.5) / D * (scale * 2)),
        r, g, b, lum,
      })
      cumW.push(total)
    }
  }

  const pos    = new Float32Array(count * 3)
  const sizes  = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const bright = new Float32Array(count)
  const phases = new Float32Array(count)
  const storms = new Float32Array(count)

  const pixelStep = (scale * 2) / D

  for (let i = 0; i < count; i++) {
    const target = Math.random() * total
    let lo = 0, hi = cumW.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      cumW[mid] < target ? (lo = mid + 1) : (hi = mid)
    }
    const c = cands[lo]

    pos[i*3]   = c.x + (Math.random() - 0.5) * pixelStep
    pos[i*3+1] = (Math.random() - 0.5) * yJitter
    pos[i*3+2] = c.z + (Math.random() - 0.5) * pixelStep

    const fine   = Math.random() < 0.35
    sizes[i]     = fine ? 0.22 + Math.random()*0.28 : 0.45 + c.lum*2.0

    colors[i*3]   = Math.pow(c.r, 0.62)
    colors[i*3+1] = Math.pow(c.g, 0.62)
    colors[i*3+2] = Math.pow(c.b, 0.62)

    bright[i] = (!fine && c.lum > 0.60 && Math.random() < 0.06)
      ? 0.50 + Math.random()*0.50 : 0

    phases[i] = Math.random()
    storms[i] = (stormFraction > 0 && !fine && Math.random() < stormFraction) ? Math.random() : 0
  }

  return { pos, sizes, colors, bright, phases, storms }
}
