import { useSyncExternalStore } from 'react'

export interface Viewport {
  w:          number
  h:          number
  aspect:     number
  /** narrow enough that desktop tracking/spacing overflows */
  isMobile:   boolean
  isPortrait: boolean
  /** landscape phones — vertical room is the scarce axis */
  isShort:    boolean
}

// Primary input is touch — used to disable hover-dependent behaviour and to
// let touch scrolling through the canvas.
export const isTouch =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * True only for a real mouse/trackpad device — what the follower cursor is for.
 *
 * `(pointer: coarse)` alone is not enough: a tablet paired with a keyboard case
 * or a stylus reports a *fine* pointer and would otherwise get a cursor ring
 * chasing a finger that isn't there. Any touchscreen narrower than
 * TABLET_MAX_W is treated as a tablet.
 *
 * The touch-capability test is what keeps a merely narrow *desktop* window —
 * no touchscreen, so maxTouchPoints is 0 — from losing its cursor.
 */
const TABLET_MAX_W = 1280   // iPad portrait is exactly 1024; clear it comfortably

export function readIsPointerDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(pointer: coarse)').matches) return false
  if (window.matchMedia('(hover: none)').matches) return false
  if (navigator.maxTouchPoints > 0 && window.innerWidth < TABLET_MAX_W) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function read(): Viewport {
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    w, h,
    aspect:     w / h,
    isMobile:   w < 768,
    isPortrait: h >= w,
    isShort:    h < 520,
  }
}

// Cached so getSnapshot returns a stable reference between resizes.
let snapshot: Viewport = typeof window === 'undefined'
  ? { w: 1440, h: 900, aspect: 1.6, isMobile: false, isPortrait: false, isShort: false }
  : read()

function getSnapshot(): Viewport {
  const next = read()
  if (next.w !== snapshot.w || next.h !== snapshot.h) snapshot = next
  return snapshot
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

/** Live viewport metrics — re-renders on resize and orientation change. */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => snapshot)
}

// Re-read on the same events as the viewport: attaching a mouse or rotating a
// tablet changes the answer, and a value frozen at module load would miss it.
let pointerSnapshot = readIsPointerDevice()

function getPointerSnapshot(): boolean {
  pointerSnapshot = readIsPointerDevice()
  return pointerSnapshot
}

function subscribePointer(onChange: () => void) {
  const queries = [
    window.matchMedia('(pointer: coarse)'),
    window.matchMedia('(hover: hover) and (pointer: fine)'),
  ]
  queries.forEach(q => q.addEventListener('change', onChange))
  window.addEventListener('resize', onChange)
  return () => {
    queries.forEach(q => q.removeEventListener('change', onChange))
    window.removeEventListener('resize', onChange)
  }
}

/** True only on mouse/trackpad devices. See {@link readIsPointerDevice}. */
export function useIsPointerDevice(): boolean {
  return useSyncExternalStore(subscribePointer, getPointerSnapshot, () => pointerSnapshot)
}
