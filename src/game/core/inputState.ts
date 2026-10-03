import type { InputAction } from '@/utils/input'

/**
 * A mutable, non-reactive singleton holding the current input state.
 *
 * This is intentionally outside React and outside Zustand. Movement reads it
 * every frame inside `useFrame`, and re-rendering React 60 times a second to
 * deliver a keypress would be exactly the kind of waste spec §29 warns about.
 * UI that genuinely needs to react (e.g. the on-screen touch buttons) reads
 * from its own component state instead.
 */

const active = new Set<InputAction>()

/** Analog stick contribution, set by the touch layer. Range -1..1. */
const stick = { x: 0, y: 0 }

/** One-frame impulse flags, consumed by the player controller. */
const pressedThisFrame = new Set<InputAction>()

export const inputState = {
  isActive(action: InputAction): boolean {
    return active.has(action)
  },

  /**
   * Movement vector in -1..1 space. `x` is strafe right, `y` is forward.
   * Keyboard and the virtual stick are summed and clamped so a player holding
   * W while pushing the stick does not move at double speed.
   */
  moveAxis(out: { x: number; y: number }): void {
    let x = stick.x
    let y = stick.y

    if (active.has('right')) x += 1
    if (active.has('left')) x -= 1
    if (active.has('forward')) y += 1
    if (active.has('back')) y -= 1

    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }

    out.x = x
    out.y = y
  },

  /** True on the frame the action went down. Cleared by `endFrame`. */
  consumePress(action: InputAction): boolean {
    if (!pressedThisFrame.has(action)) return false
    pressedThisFrame.delete(action)
    return true
  },

  press(action: InputAction): void {
    if (!active.has(action)) pressedThisFrame.add(action)
    active.add(action)
  },

  release(action: InputAction): void {
    active.delete(action)
  },

  setStick(x: number, y: number): void {
    stick.x = x
    stick.y = y
  },

  /** Drops every held key. Called when focus is lost or the game pauses. */
  clear(): void {
    active.clear()
    pressedThisFrame.clear()
    stick.x = 0
    stick.y = 0
  },

  /** Called once per frame after the game has read the state. */
  endFrame(): void {
    pressedThisFrame.clear()
  },
}
