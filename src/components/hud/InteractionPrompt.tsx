import { useInteractionStore } from '@/game/interaction/interactionStore'
import { useSessionStore } from '@/stores/sessionStore'
import { isTouchDevice } from '@/game/core/device'

/**
 * Bottom-right interaction prompt (spec §22).
 *
 * The prompt states the verb and the object ("[E] Inspect RAM") rather than a
 * bare "Press E", so the player always knows what the button will do before
 * pressing it — and the icon means the meaning survives without colour.
 */
export function InteractionPrompt() {
  const nearest = useInteractionStore((s) => s.nearest)
  const dialogueOpen = useSessionStore((s) => s.dialogue !== null)
  const isAnyOverlayOpen = useSessionStore((s) => s.overlay !== 'none')
  const paused = useSessionStore((s) => s.paused)

  if (!nearest || dialogueOpen || isAnyOverlayOpen || paused) return null

  const touch = isTouchDevice()
  const verb = nearest.definition.verb
  const label = nearest.definition.label

  return (
    <div
      role="status"
      aria-live="polite"
      className="cq-pop cq-panel pointer-events-none flex items-center gap-3 px-4 py-2.5"
    >
      <span aria-hidden="true" className="text-xl">
        {nearest.definition.icon}
      </span>

      <div className="leading-tight">
        <p className="font-display text-[0.9rem] font-bold text-cq-ink">
          {verb} {label}
        </p>
        {nearest.source === 'npc' && nearest.npcRole ? (
          <p className="text-[0.7rem] text-cq-muted">{nearest.npcRole}</p>
        ) : null}
      </div>

      {/* Key cap on desktop; on touch the on-screen button already says it. */}
      {!touch ? (
        <kbd className="ml-1 flex size-8 items-center justify-center rounded-lg border border-cq-edge bg-cq-night/80 font-display text-sm font-black text-cq-accent">
          E
        </kbd>
      ) : null}
    </div>
  )
}
