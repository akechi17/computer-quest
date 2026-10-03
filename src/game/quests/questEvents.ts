/**
 * A tiny synchronous event bus for gameplay events.
 *
 * Why a bus instead of direct calls: the interaction handler, the dialogue
 * system, the mini-game results and the player controller all generate events
 * that the quest system must react to — but none of them should import the
 * quest system, and the quest system should not import them (spec §39: do not
 * hard-code quest logic into UI). The bus is the single seam between them.
 *
 * Events are plain data, so a future backend could log them verbatim.
 */

export type QuestEvent =
  /** The player used an interactable object. `targetId` is namespaced. */
  | { type: 'interacted'; targetId: string }
  /** The player finished a conversation. `npcId` matches an objective target. */
  | { type: 'talked-to'; npcId: string }
  /** An item entered the inventory. */
  | { type: 'item-collected'; itemId: string; itemName: string }
  /** The player used something they did not have the right item for. */
  | { type: 'interaction-refused'; targetId: string; reason: string }
  /** An interaction completed a specific objective by name. */
  | { type: 'objective-completed'; objectiveId: string }
  /** A lesson overlay was shown. */
  | {
      type: 'lesson-taught'
      lessonId: string
      /** True when the overlay should offer its PRACTICE mini-game. */
      offerMinigame: boolean
    }
  /** The player entered a named location radius. */
  | { type: 'reached-location'; locationId: string }
  /** A mini-game finished. `success` is false when the player bailed out. */
  | { type: 'minigame-finished'; minigameId: string; success: boolean }
  /** A quest was marked complete and rewards applied. */
  | { type: 'quest-completed'; questId: string }
  /** A quest became active. */
  | { type: 'quest-started'; questId: string }
  /** The player used a gate they have not unlocked. */
  | { type: 'gate-locked'; zoneId: string }
  /** The player went through an unlocked gate. */
  | { type: 'gate-entered'; zoneId: string }
  /** XP was awarded, for the floating "+15 XP" toasts. */
  | { type: 'xp-gained'; amount: number }

type Listener = (event: QuestEvent) => void

const listeners = new Set<Listener>()

export const questEvents = {
  emit(event: QuestEvent): void {
    // Copy before iterating so a listener may unsubscribe during dispatch.
    for (const listener of Array.from(listeners)) {
      listener(event)
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Typed helper so callers do not have to narrow repeatedly. */
export function onQuestEvent<T extends QuestEvent['type']>(
  type: T,
  handler: (event: Extract<QuestEvent, { type: T }>) => void,
): () => void {
  return questEvents.subscribe((event) => {
    if (event.type === type) handler(event as Extract<QuestEvent, { type: T }>)
  })
}
