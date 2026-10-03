/**
 * Centralized tuning values. Spec §39 forbids scattering magic numbers through
 * components, so anything a designer would want to tweak lives here.
 */

/** Player movement, in world units per second. */
export const PLAYER = {
  WALK_SPEED: 4.2,
  RUN_SPEED: 7.6,
  /** How fast the character turns to face the movement direction. */
  TURN_LERP: 14,
  /** Responsive but not twitchy — spec §9 says avoid realistic acceleration. */
  ACCEL_LERP: 12,
  JUMP_VELOCITY: 6.2,
  /** Half-height of the character capsule. */
  CAPSULE_HALF_HEIGHT: 0.6,
  CAPSULE_RADIUS: 0.35,
  /** Character origin sits at the capsule's center, so eyes are above it. */
  MODEL_Y_OFFSET: -0.6,
} as const

export const CAMERA = {
  FOV: 55,
  NEAR: 0.1,
  FAR: 220,
  /** Where the camera looks, relative to the player's feet. */
  TARGET_HEIGHT: 1.4,
  DISTANCE: 7.5,
  /** Vertical orbit limits, in radians. Clamped so you never flip over. */
  MIN_PITCH: -0.45,
  MAX_PITCH: 1.15,
  /** Higher = snappier follow. Applied as exponential damping per second. */
  FOLLOW_LERP: 10,
  ROTATE_SENSITIVITY: 0.0032,
  MIN_DISTANCE: 2.5,
  /** Camera pulls in this far in front of a wall it would otherwise clip. */
  COLLISION_PADDING: 0.4,
} as const

export const PHYSICS = {
  GRAVITY: -22,
  /** Rapier's fixed timestep. Lower = more accurate, more expensive. */
  TIME_STEP: 1 / 60,
} as const

/** Interaction radius defaults, in world units. */
export const INTERACTION = {
  DEFAULT_RADIUS: 2.6,
  NPC_RADIUS: 3.0,
  /** The prompt only appears when the object is roughly in front of you. */
  FACING_DOT_MIN: 0.25,
} as const

export const WORLD = {
  /** Computer Village is a bounded plateau so the player cannot wander off. */
  SIZE: 90,
  GROUND_COLOR: '#5aa06a',
  PATH_COLOR: '#c9a86a',
  BOUNDARY_HEIGHT: 6,
} as const

export const RENDER = {
  /** Drei's AdaptiveDpr will drop resolution toward this under load. */
  MIN_DPR: 0.75,
  MAX_DPR: 2,
  SHADOW_MAP_SIZE: 1024,
  FOG_NEAR: 40,
  FOG_FAR: 150,
} as const

/** XP awards — spec §23. Kept in one place so lesson data can reference them. */
export const XP = {
  DISCOVER_OBJECT: 10,
  COMPLETE_MINIGAME: 50,
  COMPLETE_QUEST: 100,
  LEARN_CONCEPT: 15,
} as const
