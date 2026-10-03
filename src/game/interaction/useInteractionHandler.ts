import { useCallback, useEffect } from 'react'
import { getLesson } from '@/data/lessons'
import { resolveByteDialogue } from '@/data/dialogues'
import { FIRST_QUEST_ID, getQuest } from '@/data/quests'
import { getItem } from '@/data/items'
import { useProgressStore } from '@/stores/progressStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useInteractionStore } from './interactionStore'
import { inputState } from '@/game/core/inputState'
import { questEvents } from '@/game/quests/questEvents'
import { playCharacterAnimation } from '@/game/player/PlayerController'

/**
 * Turns "the player pressed interact on X" into game effects.
 *
 * This is the seam between the generic interaction system (spec §11) and the
 * data-driven content layer: the handler knows the *kinds* of effect that can
 * happen, but never which specific lesson or quest — all of that comes from
 * the definition it was handed.
 */
export function useInteractionHandler(): void {
  const nearest = useInteractionStore((s) => s.nearest)
  const busy = useInteractionStore((s) => s.busy)
  const setBusy = useInteractionStore((s) => s.setBusy)

  const isInputBlocked = useSessionStore((s) => s.isInputBlocked)

  const run = useCallback(
    (candidate: NonNullable<typeof nearest>) => {
      if (busy) return
      setBusy(true)

      const progress = useProgressStore.getState()

      /* ---------------------------------------------------------------- */
      /* NPCs                                                              */
      /* ---------------------------------------------------------------- */
      if (candidate.source === 'npc') {
        const hasRam = progress.hasItem('ram-module')
        const questComplete = progress.getQuestStatus(FIRST_QUEST_ID) === 'complete'
        const questActive = progress.getQuestStatus(FIRST_QUEST_ID) === 'active'
        const returnedToByte = progress.isObjectiveComplete(
          FIRST_QUEST_ID,
          'install-ram',
        )

        const treeId = resolveByteDialogue({
          questActive,
          questComplete,
          hasRam,
          returnedToByte,
        })

        playCharacterAnimation('wave', 900)
        useSessionStore.getState().startDialogue(treeId, candidate.id)
        setBusy(false)
        return
      }

      const definition = candidate.definition

      /* ---------------------------------------------------------------- */
      /* Pickups                                                           */
      /* ---------------------------------------------------------------- */
      if (definition.kind === 'pickup') {
        if (definition.grantsItem) {
          progress.addItem(definition.grantsItem)
          const item = getItem(definition.grantsItem)
          questEvents.emit({
            type: 'item-collected',
            itemId: definition.grantsItem,
            itemName: item?.name ?? definition.label,
          })
        }

        // Collecting an object always teaches its lesson, if it has one.
        if (definition.lessonId) {
          teachLesson(definition.lessonId)
        }

        playCharacterAnimation('interact', 700)
        setBusy(false)
        return
      }

      /* ---------------------------------------------------------------- */
      /* Gates                                                             */
      /* ---------------------------------------------------------------- */
      if (definition.kind === 'gate') {
        const zoneId = definition.unlocksZone
        if (zoneId && !progress.isZoneUnlocked(zoneId)) {
          questEvents.emit({ type: 'gate-locked', zoneId })
        } else {
          questEvents.emit({ type: 'gate-entered', zoneId: zoneId ?? 'unknown' })
        }
        setBusy(false)
        return
      }

      /* ---------------------------------------------------------------- */
      /* Inspectables                                                      */
      /* ---------------------------------------------------------------- */

      /*
       * The order here matters and encodes the design:
       *
       *   1. Teach the lesson (once; `teachLesson` is idempotent for XP).
       *   2. Report the plain interaction, which is what advances a discovery
       *      objective like "open the tower".
       *   3. If the object needs an item the player has not found yet, say so
       *      and stop — this is the "you can see something is missing" beat.
       *   4. Otherwise spend the item and, if the object starts one, launch its
       *      mini-game.
       *
       * Steps 1 and 2 come *before* the item check on purpose. The computer
       * tower is both "the thing you open to discover the RAM is missing" and
       * "the thing you fit the RAM into", and it is one object with one
       * consumesItem. Checking the item first made the tower refuse the
       * player at the discovery step too, so `inspect-tower` could never
       * complete, the RAM never became visible, and the quest dead-ended
       * three steps in with no way forward.
       */
      if (definition.lessonId) {
        teachLesson(definition.lessonId, {
          // A lesson that leads into a game keeps its "Try this!" affordance;
          // that is the PRACTICE step and it is the point of the whole loop.
          offerMinigame: Boolean(definition.startsMinigame),
        })
      }

      questEvents.emit({ type: 'interacted', targetId: definition.id })
      if (definition.completesObjective) {
        questEvents.emit({
          type: 'objective-completed',
          objectiveId: definition.completesObjective,
        })
      }

      if (definition.consumesItem && !progress.hasItem(definition.consumesItem)) {
        questEvents.emit({
          type: 'interaction-refused',
          targetId: definition.id,
          reason: definition.requiresItemHint ?? 'You need something else first.',
        })
        playCharacterAnimation('interact', 700)
        setBusy(false)
        return
      }

      if (definition.consumesItem) {
        progress.removeItem(definition.consumesItem)
      }

      if (definition.startsMinigame) {
        useSessionStore.getState().openOverlay('minigame')
        setBusy(false)
        return
      }

      playCharacterAnimation('interact', 700)
      setBusy(false)
    },
    [busy, setBusy],
  )

  /* The interact key is polled here rather than in the player controller so
     that UI overlays can suppress it without touching movement code. */
  useEffect(() => {
    let frame = 0

    const tick = () => {
      if (!isInputBlocked() && inputState.consumePress('interact')) {
        const current = useInteractionStore.getState().nearest
        if (current) run(current)
      }
      /* This callback is the last to read the one-frame press flags each
         frame, so it is also the one that clears them. Doing this in the
         player controller instead silently ate every interact press. */
      inputState.endFrame()
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [run, isInputBlocked])

  /* Expose an imperative trigger for the mobile interact button. */
  useEffect(() => {
    interactTrigger.fire = () => {
      const current = useInteractionStore.getState().nearest
      if (current && !useSessionStore.getState().isInputBlocked()) run(current)
    }
    return () => {
      interactTrigger.fire = () => {}
    }
  }, [run])
}

/**
 * Shows a lesson and awards its XP exactly once.
 *
 * Exported because dialogue effects and the quest system also teach lessons —
 * all three routes must award XP consistently.
 *
 * `offerMinigame` is how the lesson overlay knows to surface its "Try this!"
 * button. It is passed rather than inferred so that a lesson which *has* a
 * mini-game is not forced to offer it from every object that teaches it: the
 * `processing` lesson is reachable from several places, but only the tower is
 * where you actually fit the RAM.
 */
export function teachLesson(
  lessonId: string,
  options: { offerMinigame?: boolean } = {},
): void {
  const lesson = getLesson(lessonId)
  if (!lesson) return

  const progress = useProgressStore.getState()
  const firstTime = !progress.hasCompletedLesson(lesson.id)

  if (firstTime) {
    progress.completeLesson(lesson.id)
    progress.addXp(lesson.xp)
    if (lesson.badgeId) progress.awardBadge(lesson.badgeId)
  }

  questEvents.emit({
    type: 'lesson-taught',
    lessonId: lesson.id,
    offerMinigame: Boolean(options.offerMinigame && lesson.minigameId),
  })

  // The lesson overlay is a session concern, not persisted progress.
  useSessionStore.getState().openOverlay('lesson')
}

/** Imperative bridge for touch controls. */
export const interactTrigger = {
  fire: () => {},
}

/** Convenience for quest completion, used by the reward flow. */
export function completeQuestById(questId: string): void {
  const quest = getQuest(questId)
  if (!quest) return
  useProgressStore.getState().completeQuest(quest)
  questEvents.emit({ type: 'quest-completed', questId })
}
