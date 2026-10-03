import { useEffect } from 'react'
import { QUEST_LIST, getQuest, FIRST_QUEST_ID } from '@/data/quests'
import { getInteractive } from '@/data/world'
import { LOCATIONS } from '@/data/world'
import { useProgressStore } from '@/stores/progressStore'
import { questEvents, type QuestEvent } from './questEvents'
import { distance2D } from '@/utils/math'
import { playerTransform } from '@/game/core/playerTransform'

/**
 * The quest engine.
 *
 * It subscribes to gameplay events, matches them against every active quest's
 * *current* objective, and marks objectives complete. Two rules keep it honest:
 *
 *  1. Only the current (first incomplete) objective of an active quest can
 *     advance, so a player cannot skip ahead by poking the wrong object first.
 *  2. Objectives are matched by `kind` + `target`, never by quest id, so the
 *     same generic handler covers every quest ever authored.
 */

/** How often location objectives are polled, in seconds. */
const LOCATION_POLL_INTERVAL = 0.5

export function useQuestEngine(enabled: boolean): void {
  /* ---------------------------------------------------------------------- */
  /* Event-driven objectives                                                 */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = questEvents.subscribe((event) => {
      advanceFromEvent(event)
    })

    return unsubscribe
  }, [enabled])

  /* ---------------------------------------------------------------------- */
  /* Location objectives, which have no event to fire on                     */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!enabled) return

    const interval = window.setInterval(() => {
      const px = playerTransform.position.x
      const pz = playerTransform.position.z

      for (const quest of QUEST_LIST) {
        const progress = useProgressStore.getState()
        if (progress.getQuestStatus(quest.id) !== 'active') continue

        const objectiveId = progress.activeObjectiveId(quest)
        if (!objectiveId) continue

        const objective = quest.objectives.find((o) => o.id === objectiveId)
        if (!objective || objective.kind !== 'reach_location') continue

        const location = LOCATIONS[objective.target]
        if (!location) continue

        const [lx, , lz] = location.position
        if (distance2D(px, pz, lx, lz) <= 3.5) {
          progress.completeObjective(quest.id, objective.id)
          checkQuestCompletion(quest.id)
        }
      }
    }, LOCATION_POLL_INTERVAL * 1000)

    return () => window.clearInterval(interval)
  }, [enabled])

  /* ---------------------------------------------------------------------- */
  /* Auto-start quests                                                       */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!enabled) return
    const progress = useProgressStore.getState()
    for (const quest of QUEST_LIST) {
      if (quest.autoStart && progress.getQuestStatus(quest.id) === 'locked') {
        progress.startQuest(quest.id)
        questEvents.emit({ type: 'quest-started', questId: quest.id })
      }
    }
  }, [enabled])
}

/* -------------------------------------------------------------------------- */
/* Matching                                                                    */
/* -------------------------------------------------------------------------- */

function advanceFromEvent(event: QuestEvent): void {
  const progress = useProgressStore.getState()

  /*
   * An `objective-completed` event names the objective directly, so it is
   * handled before the per-quest scan: it is how an object in the world can
   * complete an objective that no event *kind* could express (fitting the RAM
   * is a `solve_puzzle`, but the act of using the tower is what solves it).
   * It is honoured only if that objective is genuinely the current step, so
   * the "one objective at a time" rule still holds.
   */
  if (event.type === 'objective-completed') {
    for (const quest of QUEST_LIST) {
      if (progress.getQuestStatus(quest.id) !== 'active') continue
      if (progress.activeObjectiveId(quest) !== event.objectiveId) continue
      progress.completeObjective(quest.id, event.objectiveId)
      checkQuestCompletion(quest.id)
    }
    return
  }

  for (const quest of QUEST_LIST) {
    if (progress.getQuestStatus(quest.id) !== 'active') continue

    const objectiveId = progress.activeObjectiveId(quest)
    if (!objectiveId) continue

    const objective = quest.objectives.find((o) => o.id === objectiveId)
    if (!objective) continue

    let matched = false

    switch (objective.kind) {
      case 'talk_to':
        matched = event.type === 'talked-to' && event.npcId === objective.target
        break

      case 'interact': {
        if (event.type !== 'interacted') break
        matched = targetsMatch(event.targetId, objective.target)
        break
      }

      case 'collect':
        matched =
          event.type === 'item-collected' && event.itemId === objective.target
        break

      case 'complete_minigame':
        matched =
          event.type === 'minigame-finished' &&
          event.minigameId === objective.target &&
          event.success
        break

      case 'solve_puzzle':
        // A puzzle objective is satisfied either by finishing its mini-game or
        // by the specific interaction that represents solving it.
        if (event.type === 'minigame-finished') {
          matched = event.minigameId === objective.target && event.success
        } else if (event.type === 'interacted') {
          matched = targetsMatch(event.targetId, objective.target)
        }
        break

      case 'reach_location':
        // Handled by the polling effect; no event source.
        break

      default: {
        // Exhaustiveness guard — a new ObjectiveKind must be handled above.
        const never: never = objective.kind
        void never
        break
      }
    }

    if (!matched) continue

    progress.completeObjective(quest.id, objective.id)
    checkQuestCompletion(quest.id)
  }
}

/**
 * Objectives may address an interactive by its namespaced id (`village:keyboard`)
 * while interactables are declared by local key (`keyboard`). Accept either so
 * quest data stays readable and does not break when a zone is renamed.
 */
function targetsMatch(eventTarget: string, objectiveTarget: string): boolean {
  if (eventTarget === objectiveTarget) return true
  if (eventTarget.endsWith(`:${objectiveTarget}`)) return true
  if (objectiveTarget.endsWith(`:${eventTarget}`)) return true

  // Fall back to the data table so a bare key resolves to its full id.
  const definition = getInteractive(objectiveTarget)
  if (definition && definition.id === eventTarget) return true

  return false
}

/**
 * Completes the quest once every objective is done.
 *
 * The final `talk_to` objective is intentionally the last step for the first
 * quest, so completion happens as the player reports back rather than the
 * moment they finish the puzzle.
 */
export function checkQuestCompletion(questId: string): void {
  const quest = getQuest(questId)
  if (!quest) return

  const progress = useProgressStore.getState()
  if (progress.getQuestStatus(questId) === 'complete') return
  if (!progress.isQuestFullyComplete(quest)) return

  progress.completeQuest(quest)
  questEvents.emit({ type: 'quest-completed', questId })
}

/** Id of the first quest, re-exported for convenience at call sites. */
export { FIRST_QUEST_ID }
