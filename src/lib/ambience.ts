import { gsap } from 'gsap'

// Ambient drone. A module-level singleton so it lives outside React and is
// unaffected by StrictMode's double-mount.

const SRC            = '/drone-atmospheric-ambience-betacut-1-01-01.mp3'
const TARGET_VOLUME  = 0.38
const STORAGE_KEY    = 'obscura:muted'

const el = new Audio(SRC)
el.loop   = true
el.volume = 0

let started = false

function readStoredMuted(): boolean {
  // Safari in private mode throws on localStorage access.
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

let muted = readStoredMuted()

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
    gsap.to(el, { volume: TARGET_VOLUME, duration: 5.0, ease: 'power2.out', overwrite: true })
  }).catch(() => {
    started = false
  })
}

export function setMuted(next: boolean): void {
  muted = next
  try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* private mode */ }
  // overwrite so this wins over an in-flight intro fade
  gsap.to(el, {
    volume:    next ? 0 : TARGET_VOLUME,
    duration:  next ? 0.5 : 1.2,
    ease:      'power2.out',
    overwrite: true,
  })
}
