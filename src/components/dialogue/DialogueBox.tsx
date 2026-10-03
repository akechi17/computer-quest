import { useCallback, useEffect, useMemo, useRef } from 'react'
import { getDialogue } from '@/data/dialogues'
import { useSessionStore } from '@/stores/sessionStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useProgressStore } from '@/stores/progressStore'
import { applyDialogueEffect } from '@/game/dialogue/applyDialogueEffect'
import { useTypewriter } from '@/game/dialogue/useTypewriter'
import { questEvents } from '@/game/quests/questEvents'
import { isTouchDevice } from '@/game/core/device'
import type { DialogueNode } from '@/data/types'

/**
 * The dialogue box (spec §15).
 *
 * Behaviour the spec asks for, and where each lives:
 *   - typing animation + skip  → useTypewriter, and the Skip/Continue button
 *   - character name + portrait → the header row
 *   - choices                   → rendered once typing finishes
 *   - quest triggers            → applyDialogueEffect, on node enter
 */
export function DialogueBox() {
  const dialogue = useSessionStore((s) => s.dialogue)
  const goToNode = useSessionStore((s) => s.goToDialogueNode)
  const endDialogue = useSessionStore((s) => s.endDialogue)
  const subtitles = useSettingsStore((s) => s.subtitles)

  const tree = useMemo(
    () => (dialogue ? getDialogue(dialogue.treeId) : undefined),
    [dialogue],
  )

  const node: DialogueNode | undefined = useMemo(() => {
    if (!tree || !dialogue) return undefined
    return tree.nodes[dialogue.nodeId]
  }, [tree, dialogue])

  const { displayed, isTyping, skip } = useTypewriter(node?.text ?? '')

  /* Fire the node's effect exactly once per visit. */
  const appliedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!dialogue || !node) return
    const key = `${dialogue.treeId}:${dialogue.nodeId}`
    if (appliedFor.current === key) return
    appliedFor.current = key

    if (node.onEnter) applyDialogueEffect(node.onEnter)
  }, [dialogue, node])

  /* Reset the effect guard when the conversation closes. */
  useEffect(() => {
    if (!dialogue) appliedFor.current = null
  }, [dialogue])

  /* Declared before `advance`, which calls it: referencing it earlier would be
     a temporal dead zone error the first time a conversation reaches its last
     node. */
  const finish = useCallback(() => {
    if (dialogue) {
      // Talking to an NPC is a quest event, so `talk_to` objectives advance.
      questEvents.emit({ type: 'talked-to', npcId: dialogue.sourceId })
    }
    endDialogue()
  }, [dialogue, endDialogue])

  const advance = useCallback(() => {
    if (!node) return
    if (isTyping) {
      skip()
      return
    }
    if (node.choices && node.choices.length > 0) return // must choose
    if (node.next) {
      goToNode(node.next)
    } else {
      finish()
    }
  }, [node, isTyping, skip, goToNode, finish])

  /* Keyboard: Space/Enter advances, Escape closes. */
  useEffect(() => {
    if (!dialogue) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        finish()
        return
      }
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') {
        event.preventDefault()
        advance()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialogue, advance, finish])

  if (!dialogue || !node) return null

  /* Choices are filtered by any gating objective they declare. */
  const availableChoices = (node.choices ?? []).filter((choice) => {
    if (!choice.requiresObjective) return true
    const [questId, objectiveId] = choice.requiresObjective.split(':')
    if (!questId || !objectiveId) return true
    return useProgressStore.getState().isObjectiveComplete(questId, objectiveId)
  })

  const showChoices = !isTyping && availableChoices.length > 0
  const showContinue = !isTyping && availableChoices.length === 0

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-6">
      <div
        className="cq-panel-solid cq-rise pointer-events-auto w-full max-w-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="false"
        aria-label={`Conversation with ${node.speaker}`}
      >
        {/* Header: portrait, name, and a fast-close control. */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-cq-edge bg-cq-deep text-2xl"
          >
            {node.portrait ?? '💬'}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-display text-[0.95rem] leading-tight font-bold text-cq-accent">
              {node.speaker}
            </p>
            <p className="text-[0.68rem] text-cq-muted">
              {isTyping ? 'Speaking...' : 'Ready'}
            </p>
          </div>

          <button
            type="button"
            onClick={finish}
            className="cq-button cq-button-ghost !px-2.5 !py-1 text-[0.7rem]"
            aria-label="End conversation"
          >
            Esc
          </button>
        </div>

        {/* Body. A live region so screen readers announce each new line. */}
        <p
          className="mt-3 min-h-[3.5rem] text-[0.95rem] leading-relaxed text-cq-ink"
          aria-live="polite"
        >
          {displayed}
          {isTyping ? (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-cq-accent align-middle"
            />
          ) : null}
        </p>

        {/* Subtitles setting doubles as "always show the full line", which is
            why the text above is never audio-dependent (spec §32). */}
        {!subtitles && isTyping ? null : null}

        {/* Choices */}
        {showChoices ? (
          <div className="mt-3 flex flex-col gap-2">
            {availableChoices.map((choice) => (
              <button
                key={choice.next}
                type="button"
                onClick={() => goToNode(choice.next)}
                className="cq-button cq-button-ghost cq-pop justify-start !rounded-xl text-left text-[0.9rem]"
              >
                <span aria-hidden="true" className="text-cq-accent">
                  ▸
                </span>
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Continue / skip */}
        {isTyping || showContinue ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={advance}
              className="cq-button cq-button-primary text-[0.85rem]"
            >
              {isTyping ? 'Skip' : node.next ? 'Continue' : 'Done'}
              {!isTouchDevice() && !isTyping ? (
                <kbd className="ml-1 rounded border border-black/20 px-1.5 py-0.5 text-[0.65rem] font-bold">
                  Space
                </kbd>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
