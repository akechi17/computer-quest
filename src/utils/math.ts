import { Vector3 } from 'three'

/**
 * Frame-rate independent exponential damping.
 *
 * `lerp(a, b, 0.1)` moves further per second at 144fps than at 30fps, which
 * makes movement feel different on every machine. This converges at the same
 * real-world rate regardless of frame time.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

/** Shortest-path angular damp, so turning from 350° to 10° goes forward. */
export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Converts a yaw angle (radians) into a unit direction on the XZ plane. */
export function headingToVector(yaw: number, out = new Vector3()): Vector3 {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw))
}

/** Distance between two points on the XZ plane, ignoring height. */
export function distance2D(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = ax - bx
  const dz = az - bz
  return Math.sqrt(dx * dx + dz * dz)
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
