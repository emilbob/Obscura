// Camera framing compensation.
//
// `fov` is vertical, so the horizontal field collapses with the aspect ratio.
// The scenes are composed on a wide desktop viewport; on a portrait phone the
// same camera crops centred subjects (the aperture rings, the galaxy discs)
// hard at both edges. Compensate by pulling the camera back rather than
// widening the lens — a wider fov would fisheye the perspective these scenes
// are built around.

/** Aspect the scenes are composed for. At or above this, framing is untouched. */
const REF_ASPECT = 1.5

/**
 * Distance multiplier for the current aspect.
 *
 * @param strength 1 = fully restore the desktop horizontal field (use for
 *   discrete subjects that must be seen whole); < 1 = partial, keeping the
 *   subject closer at the cost of some crop.
 * @param max      ceiling on the pullback.
 */
export function framingScale(aspect: number, strength = 1, max = 3): number {
  if (!(aspect > 0) || aspect >= REF_ASPECT) return 1
  return Math.min(max, Math.pow(REF_ASPECT / aspect, strength))
}
