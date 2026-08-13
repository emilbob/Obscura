// Ambient drone. A module-level singleton so it lives outside React and is
// unaffected by StrictMode's double-mount.

const SRC           = '/drone-atmospheric-ambience-betacut-1-01-01.mp3'
const TARGET_VOLUME = 0.38
const FADE_IN_MS    = 5000
const FADE_OUT_MS   = 500
const FADE_UP_MS    = 1200

const el = new Audio(SRC)
el.loop   = true
el.volume = 0

let started = false

// Deliberately not persisted. Entering is an explicit opt-in to the
// experience, so every visit starts with sound; muting applies to the current
// visit only. Persisting it meant one mute silenced the site on every later
// visit, with nothing on screen explaining why.
let muted = false

// Hand-rolled rather than a GSAP tween. `new Audio()` is an HTMLMediaElement,
// so GSAP treats it as a DOM target and routes `volume` through its CSS
// handling instead of setting the JS property — the tween runs to completion
// and reports progress 1 while the volume never moves.
let fadeFrame = 0

function fadeTo(target: number, durationMs: number): void {
  cancelAnimationFrame(fadeFrame)
  const from  = el.volume
  const delta = target - from
  if (delta === 0) return

  const start = performance.now()
  const step = (now: number) => {
    const t     = Math.min(1, (now - start) / durationMs)
    const eased = 1 - (1 - t) * (1 - t)          // power2.out
    // clamped: the DOM throws on a volume outside 0–1
    el.volume = Math.min(1, Math.max(0, from + delta * eased))
    if (t < 1) fadeFrame = requestAnimationFrame(step)
  }
  fadeFrame = requestAnimationFrame(step)
}

// Two AudioToggles are mounted at once — GalaxyExperience's overlay covers
// TopControls without unmounting it — so the mute state has to live here and be
// subscribable. With local component state, muting inside a galaxy left the
// other toggle showing the opposite of reality once you returned.
const listeners = new Set<() => void>()

export function subscribeMuted(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function isMuted(): boolean {
  return muted
}

/**
 * Must be called synchronously inside a user gesture — browsers block
 * `play()` otherwise.
 */
export function startAmbience(): void {
  if (started) return
  started = true
  el.play().then(() => {
    // The reader may have muted while play() was still pending, and this
    // fade would otherwise override that.
    if (muted) return
    fadeTo(TARGET_VOLUME, FADE_IN_MS)
  }).catch(() => {
    started = false
  })
}

export function setMuted(next: boolean): void {
  if (muted === next) return
  muted = next
  fadeTo(next ? 0 : TARGET_VOLUME, next ? FADE_OUT_MS : FADE_UP_MS)
  listeners.forEach(l => l())
}
