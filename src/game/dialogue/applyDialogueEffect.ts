import type { DialogueEffect } from '@/data/types'
import { QUEST_LIST } from '@/data/quests'
import { getItem } from '@/data/items'
import { useProgressStore } from '@/stores/progressStore'
import { questEvents } from '@/game/quests/questEvents'
import { teachLesson } from '@/game/interaction/useInteractionHandler'
import { checkQuestCompletion } from '@/game/quests/useQuestEngine'

/**
 * Applies the declarative side effects a dialogue node declares (spec §15).
 *
 * Dialogue files stay pure content — they name effects, and this one place
 * knows how to perform them. Adding a new kind of effect means adding a field
 * to the interface and a case here.
 */
export function applyDialogueEffect(effect: DialogueEffect): void {
  const progress = useProgressStore.getState()

  if (effect.startQuest) {
    const questId = effect.startQuest
    if (progress.getQuestStatus(questId) === 'locked') {
      progress.startQuest(questId)
      questEvents.emit({ type: 'quest-started', questId })
    }
  }

  if (effect.completeObjective) {
    // Effects name an objective; we find its owning quest so dialogue data
    // does not have to repeat the quest id at every use site.
    const questId = findQuestForObjective(effect.completeObjective)
    if (questId) {
      progress.completeObjective(questId, effect.completeObjective)
      // Dialogue can be the *last* step of a quest (reporting back to
      // Professor Byte), so completion must be re-checked here too — without
      // this the final conversation completed the objective but never the
      // quest, and the player was left holding an unfinished quest forever.
      checkQuestCompletion(questId)
    }
  }

  if (effect.teachLesson) {
    teachLesson(effect.teachLesson)
  }

  if (effect.grantItem) {
    const itemId = effect.grantItem
    progress.addItem(itemId)
    // Look the display name up so the toast reads "Found: RAM module" rather
    // than leaking the raw data key at the player.
    const item = getItem(itemId)
    questEvents.emit({ type: 'item-collected', itemId, itemName: item?.name ?? itemId })
  }

  if (effect.unlockZone) {
    progress.unlockZone(effect.unlockZone)
  }
}

/** Which quest owns this objective id. The quest list is small enough to scan. */
function findQuestForObjective(objectiveId: string): string | null {
  for (const quest of QUEST_LIST) {
    if (quest.objectives.some((objective) => objective.id === objectiveId)) {
      return quest.id
    }
  }
  return null
}
