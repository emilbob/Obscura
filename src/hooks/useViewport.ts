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

// Pointer capability is fixed for the session; size is not.
export const isTouch =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

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
