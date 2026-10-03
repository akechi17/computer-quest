import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { levelSummary } from '@/services/progress/levelSummary'

/**
 * Title screen (spec §34 flow: TITLE SCREEN → NEW GAME → spawn).
 *
 * Deliberately minimal: a title, two buttons, and a quiet control hint. The
 * spec warns against overwhelming the player, and that starts here.
 */
export function TitleScreen() {
  const navigate = useNavigate()
  const beginGame = useSessionStore((s) => s.beginGame)
  const openOverlay = useSessionStore((s) => s.openOverlay)

  const xp = useProgressStore((s) => s.xp)
  const level = useProgressStore((s) => s.level)()
  const levelTitle = useProgressStore((s) => s.levelTitle)()
  const questProgress = useProgressStore((s) => s.questProgress)
  const resetProgress = useProgressStore((s) => s.resetProgress)

  const [confirmingReset, setConfirmingReset] = useState(false)

  /* The save is only "in progress" if the player has actually done something. */
  const hasSave = xp > 0 || Object.keys(questProgress).length > 0
  const summary = levelSummary(questProgress)

  /* Starting the game is two things: opening the session, and navigating to
     the game route. The route is what mounts the canvas — `beginGame` alone
     only flips a flag, so forgetting the navigation left the player on a title
     screen that looked like it had ignored the click. */
  const startGame = useCallback(() => {
    beginGame()
    navigate('/game')
  }, [beginGame, navigate])

  /* Enter starts the game — the first key a player tries. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault()
        if (confirmingReset) return
        startGame()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [startGame, confirmingReset])

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-cq-night via-cq-deep to-cq-night p-6">
      {/* Decorative circuit motif — cheap CSS, no image asset. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-cq-accent) 1px, transparent 1px), linear-gradient(90deg, var(--color-cq-accent) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md text-center">
        <p className="font-display text-[0.72rem] font-bold tracking-[0.4em] text-cq-accent uppercase">
          Explore · Discover · Understand
        </p>
        <h1 className="mt-1 font-display text-5xl font-black tracking-tight text-cq-ink sm:text-6xl">
          Computer
          <span className="block bg-gradient-to-r from-cq-accent to-cq-gold bg-clip-text text-transparent">
            Quest
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-[0.9rem] leading-relaxed text-cq-muted">
          The village computer has gone quiet. Explore a world built from the
          parts of a computer, and find out why.
        </p>

        {/* Save summary */}
        {hasSave ? (
          <div className="cq-panel mx-auto mt-6 w-full max-w-xs px-4 py-3 text-left">
            <p className="font-display text-[0.65rem] font-bold tracking-[0.18em] text-cq-muted uppercase">
              Continue your journey
            </p>
            <p className="mt-1 font-display text-[0.95rem] font-bold text-cq-ink">
              Level {level} · {levelTitle}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-cq-muted">
              {xp} XP · {summary.completed} quest
              {summary.completed === 1 ? '' : 's'} done
            </p>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={startGame}
            className="cq-button cq-button-primary w-full max-w-xs !py-3 text-base"
          >
            {hasSave ? 'Continue' : 'New Game'}
            <span aria-hidden="true">▸</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openOverlay('profile')}
              className="cq-button cq-button-ghost text-[0.85rem]"
            >
              <span aria-hidden="true">🎒</span> Profile
            </button>
            <button
              type="button"
              onClick={() => openOverlay('map')}
              className="cq-button cq-button-ghost text-[0.85rem]"
            >
              <span aria-hidden="true">🗺️</span> Map
            </button>
          </div>

          {hasSave ? (
            confirmingReset ? (
              <div className="cq-rise cq-panel mt-2 w-full max-w-xs p-3">
                <p className="text-[0.78rem] text-cq-ink">
                  Erase all progress and start over?
                </p>
                <div className="mt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetProgress()
                      setConfirmingReset(false)
                    }}
                    className="cq-button cq-button-ghost !py-1.5 text-[0.78rem] !text-cq-bad"
                  >
                    Erase
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="cq-button cq-button-ghost !py-1.5 text-[0.78rem]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="text-[0.72rem] text-cq-muted underline decoration-dotted underline-offset-4 hover:text-cq-ink"
              >
                Start over
              </button>
            )
          ) : null}
        </div>

        {/* Controls, stated once, plainly. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[0.72rem] text-cq-muted">
          <Hint keys="WASD" label="Move" />
          <Hint keys="Shift" label="Run" />
          <Hint keys="Space" label="Jump" />
          <Hint keys="E" label="Interact" />
          <Hint keys="Drag" label="Look" />
        </div>
      </div>
    </div>
  )
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-cq-edge bg-cq-deep px-1.5 py-0.5 font-display text-[0.65rem] font-bold text-cq-ink">
        {keys}
      </kbd>
      {label}
    </span>
  )
}
