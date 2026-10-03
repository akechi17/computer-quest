import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hud } from '@/components/hud/Hud'
import { DialogueBox } from '@/components/dialogue/DialogueBox'
import { LessonOverlay } from '@/components/ui/LessonOverlay'
import { RamSortingGame } from '@/components/minigames/RamSortingGame'
import { PauseMenu } from '@/components/menus/PauseMenu'
import { ProfilePanel } from '@/components/menus/ProfilePanel'
import { MapPanel } from '@/components/menus/MapPanel'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * The 3D engine is loaded on demand rather than imported at the top level.
 * This is what lets the title screen and the loading screen paint before the
 * ~3 MB of three + rapier has finished downloading (spec §29, §30). The
 * `manualChunks` rules in `vite.config.ts` keep those two libraries in their
 * own chunks so the shell's chunk stays small.
 */
const GameCanvas = lazy(() =>
  import('@/game/core/GameCanvas').then((module) => ({
    default: module.GameCanvas,
  })),
)

/**
 * The game route: one canvas with the UI layered over it.
 *
 * Every overlay is mounted here rather than inside the canvas, because the 3D
 * tree should never re-render because a panel opened (spec §29).
 */
export function GameRoute() {
  const navigate = useNavigate()

  const started = useSessionStore((s) => s.started)
  const overlay = useSessionStore((s) => s.overlay)
  const paused = useSessionStore((s) => s.paused)
  const dialogue = useSessionStore((s) => s.dialogue)
  const closeOverlay = useSessionStore((s) => s.closeOverlay)

  /* The loading screen runs its own asset sampling (it needs drei's loader
     context) and tells us when it is finished. */
  const [worldReady, setWorldReady] = useState(false)

  const leaveToTitle = () => {
    closeOverlay()
    useSessionStore.getState().setPaused(false)
    navigate('/')
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cq-night">
      <ErrorBoundary
        fallback={<SceneFallback onReturn={leaveToTitle} />}
        onError={(error) => console.error('[Computer Quest] scene error', error)}
      >
        {/* The loading screen doubles as the Suspense fallback: while the 3D
            chunk downloads there is nothing else meaningful to show. */}
        <Suspense
          fallback={<LoadingScreen onReady={() => undefined} />}
        >
          <GameCanvas />
        </Suspense>
      </ErrorBoundary>

      {started && worldReady ? <Hud /> : null}
      {dialogue ? <DialogueBox /> : null}

      {overlay === 'lesson' ? <LessonOverlay /> : null}
      {overlay === 'minigame' ? <RamSortingGame /> : null}
      {overlay === 'profile' ? <ProfilePanel /> : null}
      {overlay === 'map' ? <MapPanel /> : null}
      {paused ? <PauseMenu onQuit={leaveToTitle} /> : null}

      {!worldReady ? (
        <LoadingScreen onReady={() => setWorldReady(true)} />
      ) : null}
    </div>
  )
}

/**
 * What the player sees if the 3D scene throws (spec §30). It offers a way out
 * rather than a dead end, and the save data is untouched.
 */
function SceneFallback({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-cq-night px-6 text-center">
      <span aria-hidden="true" className="text-4xl">
        🛠️
      </span>
      <h2 className="font-display text-xl font-black text-cq-ink">
        The 3D scene hit a problem
      </h2>
      <p className="max-w-sm text-[0.82rem] text-cq-muted">
        Your progress is safe. Try reloading the page, or lower the quality
        setting from the pause menu on a slower machine.
      </p>
      <button
        type="button"
        onClick={onReturn}
        className="cq-button cq-button-primary mt-1"
      >
        Back to title
      </button>
    </div>
  )
}
