/**
 * Device capability detection.
 *
 * Kept as a cached module-level read rather than a hook: the answer cannot
 * change during a session, and several non-React code paths need it.
 */

let cachedTouch: boolean | null = null

/**
 * True on phones and tablets.
 *
 * We check for a coarse pointer rather than merely for touch support, because
 * many laptops have touchscreens *and* a mouse — those players want the
 * desktop control scheme (spec §36: do not compromise the desktop experience).
 */
export function isTouchDevice(): boolean {
  if (cachedTouch !== null) return cachedTouch

  if (typeof window === 'undefined') {
    cachedTouch = false
    return cachedTouch
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const noHover = window.matchMedia('(hover: none)').matches

  cachedTouch = coarsePointer && noHover
  return cachedTouch
}

/** True when the viewport is narrow enough that the HUD must compact itself. */
export function isCompactViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 900
}
