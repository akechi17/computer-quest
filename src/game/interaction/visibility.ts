import type { InteractiveDefinition } from '@/data/types'
import { FIRST_QUEST_ID } from '@/data/quests'
import type { ProgressState } from '@/stores/progressStore'

/**
 * Decides which interactables the player may currently see and use.
 *
 * Keeping this in one pure function means the detector, the scene renderer and
 * the minimap all agree on what exists — a hidden object is neither drawn nor
 * interactable, and there is exactly one place to look when they disagree.
 */
export function isInteractiveVisible(
  definition: InteractiveDefinition,
  progress: ProgressState,
): boolean {
  // Zone-gated objects (the Hardware Lab contents) stay hidden until unlocked.
  if (definition.requiresZone && !progress.isZoneUnlocked(definition.requiresZone)) {
    return false
  }

  // Objects revealed by quest progress.
  if (definition.visibleWhenObjective) {
    const [questId, objectiveId] = definition.visibleWhenObjective.split(':')
    if (!questId || !objectiveId) return true
    if (!progress.isObjectiveComplete(questId, objectiveId)) return false
  }

  // The missing RAM module only appears once the player has opened the tower
  // and learned something is absent. Before that it would be a freebie.
  if (definition.id === 'missing-ram') {
    return progress.isObjectiveComplete(FIRST_QUEST_ID, 'inspect-tower')
  }

  return true
}

export function visibleInteractives(
  progress: ProgressState,
  definitions: readonly InteractiveDefinition[],
): Set<string> {
  const visible = new Set<string>()
  for (const definition of definitions) {
    if (isInteractiveVisible(definition, progress)) visible.add(definition.id)
  }
  return visible
}

/**
 * The camera-facing highlight for interactables (spec §21).
 *
 * Returns the object id the current objective points at, so the scene can give
 * exactly one thing a subtle lift instead of glowing everything.
 */
export function highlightForObjective(
  objectiveTarget: string | null,
  definitions: readonly InteractiveDefinition[],
): string | null {
  if (!objectiveTarget) return null

  for (const definition of definitions) {
    if (definition.id === objectiveTarget) return definition.id
    // Objectives address interactives by their namespaced id, and the data
    // file lists them by local key — match on the suffix as a fallback.
    if (objectiveTarget.endsWith(`:${definition.id}`)) return definition.id
  }

  return null
}
