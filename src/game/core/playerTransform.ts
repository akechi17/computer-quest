import { Vector3 } from 'three'

/**
 * The player's live world transform, shared between the player controller, the
 * follow camera, the interaction detector and the minimap.
 *
 * This is a plain mutable object rather than React state for the same reason
 * as `inputState`: it changes every frame. Anything that needs to *display*
 * the player's position (the minimap) samples it on its own throttled tick.
 */
export const playerTransform = {
  position: new Vector3(0, 1, 4),
  /** Radians. The direction the character is facing. */
  heading: 0,
  /** True while the character is on the ground, used for jump gating. */
  grounded: true,
  /** Normalised 0..1 speed, for animation blending and footstep timing. */
  speed: 0,
  /**
   * How far the character may still travel this frame before a wall stops it,
   * in metres, or `null` when nothing is in the way.
   *
   * Published for the automated tests: a wall that silently fails to apply
   * looks identical to one that is simply absent, and this project's collision
   * bugs have all been of that kind.
   */
  wallLimit: null as number | null,
}
