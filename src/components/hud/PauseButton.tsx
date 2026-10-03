import { useSessionStore } from '@/stores/sessionStore'
import { isTouchDevice } from '@/game/core/device'

/**
 * Pause and map buttons, top-right.
 *
 * Both are needed on touch (there is no Escape key) and useful on desktop, so
 * they are always rendered — but the keyboard hints are suppressed on touch.
 */
export function PauseButton() {
  const setPaused = useSessionStore((s) => s.setPaused)
  const openOverlay = useSessionStore((s) => s.openOverlay)
  const touch = isTouchDevice()

  return (
    <>
      <button
        type="button"
        onClick={() => openOverlay('map')}
        className="cq-button cq-button-ghost !px-3 !py-2 text-[0.8rem]"
        aria-label="Open map"
      >
        <span aria-hidden="true">🗺️</span>
        <span className="hidden sm:inline">Map</span>
      </button>

      <button
        type="button"
        onClick={() => setPaused(true)}
        className="cq-button cq-button-ghost !px-3 !py-2 text-[0.8rem]"
        aria-label="Pause and settings"
      >
        <span aria-hidden="true">⏸️</span>
        <span className="hidden sm:inline">Pause</span>
        {!touch ? (
          <kbd className="hidden rounded border border-cq-edge px-1.5 py-0.5 text-[0.6rem] font-bold sm:inline">
            Esc
          </kbd>
        ) : null}
      </button>
    </>
  )
}
