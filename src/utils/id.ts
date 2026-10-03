/**
 * Deterministic, stable ids for scene objects.
 *
 * Interaction targets are keyed by these strings in the interaction store, so
 * they must be stable across re-renders — `useId` would change them on remount
 * and break quest state. See spec §11.
 */
export function interactionId(zone: string, object: string): string {
  return `${zone}:${object}`
}

/** Type guard for reading unknown JSON (e.g. localStorage) without `any`. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
