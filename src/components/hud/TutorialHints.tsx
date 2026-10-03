import { useEffect, useState } from 'react'
import { useProgressStore } from '@/stores/progressStore'
import { useSessionStore } from '@/stores/sessionStore'
import { FIRST_QUEST_ID } from '@/data/quests'
import { isTouchDevice } from '@/game/core/device'
import { playerTransform } from '@/game/core/playerTransform'
import { distance2D } from '@/utils/math'

/**
 * Gradual onboarding (spec §33).
 *
 * The spec is explicit that instructions arrive one at a time and must not
 * overwhelm, so this shows a single line, waits until the player has actually
 * done the thing, and only then moves on. It never stacks a list.
 *
 * Each step is derived from real progress rather than a parallel tutorial
 * state machine, so the hints stay truthful even when the player does things
 * out of order — walking straight to the computer instead of to the guide.
 */

/** Spawn point, used to detect that the player has actually set off. */
const SPAWN = { x: 0, z: 4 }
const MOVED_DISTANCE = 3

interface TutorialStep {
  id: string
  /** Rendered text. Touch phrasing differs from keyboard phrasing. */
  text: (touch: boolean) => string
  /** The step is finished once this is true. */
  isDone: () => boolean
}

const STEPS: TutorialStep[] = [
  {
    id: 'move',
    text: (touch) => (touch ? 'Drag the joystick to walk' : 'Use WASD to move'),
    isDone: () => hasMoved(),
  },
  {
    id: 'talk',
    text: (touch) =>
      touch
        ? 'Walk to Professor Byte and tap Interact'
        : 'Move near Professor Byte and press E to talk',
    isDone: () =>
      useProgressStore
        .getState()
        .isObjectiveComplete(FIRST_QUEST_ID, 'talk-to-byte'),
  },
  {
    id: 'investigate',
    text: (touch) =>
      touch
        ? 'Follow the golden ring, then tap Interact'
        : 'Follow the golden ring, then press E to inspect',
    isDone: () =>
      useProgressStore
        .getState()
        .isObjectiveComplete(FIRST_QUEST_ID, 'inspect-monitor'),
  },
]

/** Module-level so it survives component remounts within a session. */
let movedFlag = false

function hasMoved(): boolean {
  return movedFlag
}

export function TutorialHints() {
  const started = useSessionStore((s) => s.started)
  const [tick, setTick] = useState(0)
  const [touch] = useState(() => isTouchDevice())

  /* Detect "the player has taken a step" from the shared transform, so it
     works identically for keyboard and touch. Polled cheaply — this is a
     one-time check, not a per-frame concern. */
  useEffect(() => {
    if (!started || movedFlag) return

    const interval = window.setInterval(() => {
      if (movedFlag) {
        window.clearInterval(interval)
        return
      }
      const moved =
        distance2D(
          playerTransform.position.x,
          playerTransform.position.z,
          SPAWN.x,
          SPAWN.z,
        ) > MOVED_DISTANCE

      if (moved) {
        movedFlag = true
        window.clearInterval(interval)
        setTick((n) => n + 1)
      }
    }, 250)

    return () => window.clearInterval(interval)
  }, [started])

  /* Re-evaluate the steps whenever quest progress changes. */
  useEffect(() => {
    return useProgressStore.subscribe(() => setTick((n) => n + 1))
  }, [])

  if (!started) return null

  // `tick` is not read directly — it exists to force a re-evaluation.
  void tick

  const step = STEPS.find((candidate) => !candidate.isDone())
  if (!step) return null

  return (
    <div className="absolute bottom-28 left-1/2 -translate-x-1/2 sm:bottom-20">
      <div
        role="status"
        aria-live="polite"
        className="cq-panel cq-rise flex items-center gap-2.5 px-4 py-2"
      >
        <span aria-hidden="true" className="cq-bob text-lg">
          🧭
        </span>
        <p className="text-[0.82rem] font-medium text-cq-ink">
          {step.text(touch)}
        </p>
      </div>
    </div>
  )
}
