/**
 * Input action identifiers.
 *
 * Game code never reads raw key codes or touch events — it asks the input layer
 * whether an action is active. That is what lets keyboard, touch, and (later)
 * gamepad share one movement implementation. Spec §10.
 */
export type InputAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'run'
  | 'interact'

/** Maps a KeyboardEvent.code to the action it drives. */
export const KEY_BINDINGS: Readonly<Record<string, InputAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'interact',
}

/**
 * Keys we swallow so the browser does not scroll the page or trigger
 * spacebar-activates-focused-button behaviour during play.
 */
export const PREVENTED_KEYS: ReadonlySet<string> = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])
