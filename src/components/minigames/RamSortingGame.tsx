import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { getLesson } from '@/data/lessons'
import { questEvents } from '@/game/quests/questEvents'
import { playCharacterAnimation } from '@/game/player/PlayerController'

/**
 * RAM Sorting — the PRACTICE step (spec §17).
 *
 * The mechanic: applications arrive wanting memory. RAM holds 8 GB. The player
 * decides what stays open. When RAM is full and something new arrives, they
 * must close something first — which is the entire lesson, taught by the
 * mechanic rather than by a paragraph of text.
 *
 * The spec is explicit: "Make the mechanic visually obvious. Do not explain
 * everything using text." So the capacity bar is the primary UI, and the
 * running commentary stays to one short line.
 */

const TOTAL_RAM_GB = 8

interface AppDefinition {
  id: string
  name: string
  icon: string
  gb: number
  /** Shown once, the first time this app is loaded. */
  note?: string
}

const APPS: AppDefinition[] = [
  { id: 'browser', name: 'Browser', icon: '🌐', gb: 3, note: 'Browsers are memory-hungry.' },
  { id: 'music', name: 'Music', icon: '🎵', gb: 1 },
  { id: 'game', name: 'Game', icon: '🎮', gb: 4, note: 'Games need a lot of RAM.' },
  { id: 'document', name: 'Document', icon: '📄', gb: 1 },
  { id: 'video', name: 'Video editor', icon: '🎬', gb: 5 },
  { id: 'chat', name: 'Chat', icon: '💬', gb: 1 },
  { id: 'photos', name: 'Photos', icon: '🖼️', gb: 2 },
  { id: 'code', name: 'Code editor', icon: '💻', gb: 3 },
]

/** Apps the player must successfully load to finish the practice. */
const TARGET_LOADS = 6

/* -------------------------------------------------------------------------- */
/* Game state                                                                  */
/* -------------------------------------------------------------------------- */

interface GameState {
  /** Ids of apps currently resident in RAM. */
  resident: string[]
  /** The app currently asking to load, or null between requests. */
  incoming: AppDefinition | null
  loaded: number
  mistakes: number
  /** Human-readable feedback about the last action. */
  feedback: { text: string; tone: 'good' | 'warn' } | null
  finished: boolean
  /** Deferred so the reducer stays pure. */
  queue: AppDefinition[]
}

type GameAction =
  | { type: 'offer'; app: AppDefinition }
  | { type: 'accept' }
  | { type: 'close'; appId: string; deferNext: boolean }
  | { type: 'next' }
  | { type: 'finish' }
  | { type: 'reset'; queue: AppDefinition[] }

function usedGb(resident: string[]): number {
  return resident.reduce((total, id) => {
    const app = APPS.find((candidate) => candidate.id === id)
    return total + (app?.gb ?? 0)
  }, 0)
}

function createInitialState(queue: AppDefinition[]): GameState {
  return {
    resident: [],
    incoming: null,
    loaded: 0,
    mistakes: 0,
    feedback: null,
    finished: false,
    queue,
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'offer':
      return { ...state, incoming: action.app, feedback: null }

    case 'accept': {
      if (!state.incoming) return state
      const nextResident = [...state.resident, state.incoming.id]
      const loaded = state.loaded + 1

      return {
        ...state,
        resident: nextResident,
        incoming: null,
        loaded,
        finished: loaded >= TARGET_LOADS,
        feedback: state.incoming.note
          ? { text: state.incoming.note, tone: 'good' }
          : { text: `${state.incoming.name} is now in RAM.`, tone: 'good' },
      }
    }

    case 'close': {
      const nextResident = state.resident.filter((id) => id !== action.appId)
      const closedApp = APPS.find((app) => app.id === action.appId)

      // Closing something frees exactly its memory — then the waiting app can
      // load without the player pressing anything else.
      const stateAfterClose: GameState = {
        ...state,
        resident: nextResident,
        feedback: closedApp
          ? {
              text: `Closed ${closedApp.name} — ${closedApp.gb} GB freed.`,
              tone: 'good',
            }
          : null,
      }

      if (action.deferNext && state.incoming) {
        const canFit =
          usedGb(nextResident) + state.incoming.gb <= TOTAL_RAM_GB

        if (canFit) {
          return reducer(stateAfterClose, { type: 'accept' })
        }
      }

      return stateAfterClose
    }

    case 'next': {
      const [head, ...rest] = state.queue
      if (!head) return { ...state, incoming: null }
      return { ...state, queue: rest, incoming: head, feedback: null }
    }

    case 'finish':
      return { ...state, finished: true, incoming: null }

    case 'reset':
      return createInitialState(action.queue)

    default:
      return state
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function RamSortingGame() {
  const overlay = useSessionStore((s) => s.overlay)
  const closeOverlay = useSessionStore((s) => s.closeOverlay)

  /* Build the request queue once per mount. Deterministic order rather than
     random, so the difficulty curve is authored: cheap apps first, then a
     request that only fits if the player closes something. */
  const initialQueue = useMemo<AppDefinition[]>(
    () => [
      APPS[0]!, // browser 3
      APPS[1]!, // music 1
      APPS[3]!, // document 1
      APPS[2]!, // game 4  — forces a decision
      APPS[6]!, // photos 2
      APPS[5]!, // chat 1
    ],
    [],
  )

  const [state, dispatch] = useReducer(reducer, initialQueue, createInitialState)
  const [hasReported, setHasReported] = useState(false)
  const startedRef = useRef(false)

  const used = usedGb(state.resident)
  const free = TOTAL_RAM_GB - used
  const incomingFits = state.incoming ? state.incoming.gb <= free : true

  /* Kick off the first request when the overlay opens. */
  useEffect(() => {
    if (overlay !== 'minigame') {
      startedRef.current = false
      setHasReported(false)
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    dispatch({ type: 'reset', queue: initialQueue })
    dispatch({ type: 'next' })
  }, [overlay, initialQueue])

  /* After an action, bring in the next request — unless the player is still
     over capacity, in which case they must close something first. */
  useEffect(() => {
    if (overlay !== 'minigame' || state.finished) return
    if (state.incoming !== null) return
    if (state.queue.length === 0) return

    const timer = window.setTimeout(() => dispatch({ type: 'next' }), 700)
    return () => window.clearTimeout(timer)
  }, [state.incoming, state.queue.length, state.finished, overlay])

  const reportResult = useCallback(
    (success: boolean) => {
      if (hasReported) return
      setHasReported(true)

      questEvents.emit({
        type: 'minigame-finished',
        minigameId: 'ram-sorting',
        success,
      })

      if (success) {
        const lesson = getLesson('ram')
        // Practising a concept is worth XP even if the lesson was read already.
        useProgressStore.getState().addXp(20)
        if (lesson?.badgeId) {
          useProgressStore.getState().awardBadge(lesson.badgeId)
        }
        playCharacterAnimation('celebrate', 2000)
      }
    },
    [hasReported],
  )

  useEffect(() => {
    if (state.finished) reportResult(true)
  }, [state.finished, reportResult])

  useEffect(() => {
    if (overlay !== 'minigame') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        // Bailing out is not a failure — the spec says do not punish.
        reportResult(state.finished)
        closeOverlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [overlay, closeOverlay, reportResult, state.finished])

  if (overlay !== 'minigame') return null

  const handleIncoming = () => {
    if (!state.incoming) return
    if (incomingFits) {
      dispatch({ type: 'accept' })
    } else {
      // The player tried to load something too big: point at the bar, do not
      // scold. The mechanic is the teacher.
      dispatch({ type: 'finish' })
      dispatch({ type: 'reset', queue: [] })
    }
  }

  const handleClose = (appId: string) => {
    dispatch({ type: 'close', appId, deferNext: true })
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cq-night/80 p-3 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ram-game-title"
        className="cq-panel-solid cq-pop flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-cq-edge/60 px-5 py-3.5">
          <span aria-hidden="true" className="text-2xl">
            💾
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="ram-game-title"
              className="font-display text-lg leading-tight font-black text-cq-ink"
            >
              RAM Sorting
            </h2>
            <p className="text-[0.72rem] text-cq-muted">
              Loaded {state.loaded}/{TARGET_LOADS} apps · keep RAM from overflowing
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reportResult(state.finished)
              closeOverlay()
            }}
            className="cq-button cq-button-ghost !px-3 !py-1.5 text-[0.75rem]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* ------------------------------------------------------------ */}
          {/* The capacity bar — the primary teaching surface               */}
          {/* ------------------------------------------------------------ */}
          <section>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-display text-[0.7rem] font-bold tracking-[0.16em] text-cq-muted uppercase">
                RAM
              </span>
              <span className="text-[0.8rem] tabular-nums font-semibold text-cq-ink">
                {used} GB / {TOTAL_RAM_GB} GB
                <span
                  className={[
                    'ml-2 text-[0.72rem]',
                    free === 0 ? 'text-cq-bad' : 'text-cq-muted',
                  ].join(' ')}
                >
                  ({free} GB free)
                </span>
              </span>
            </div>

            {/* Segmented bar: each resident app is its own block, so the player
                can see *what* is taking the space, not just how much. */}
            <div className="flex h-9 gap-1 overflow-hidden rounded-xl border border-cq-edge bg-cq-night/60 p-1">
              {state.resident.map((appId) => {
                const app = APPS.find((candidate) => candidate.id === appId)
                if (!app) return null
                return (
                  <div
                    key={appId}
                    className="cq-pop flex items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-cq-accent/35 to-cq-accent/20 text-[0.68rem] font-bold text-cq-ink"
                    style={{ flexGrow: app.gb }}
                    title={`${app.name} — ${app.gb} GB`}
                  >
                    <span aria-hidden="true">{app.icon}</span>
                    <span className="tabular-nums">{app.gb}GB</span>
                  </div>
                )
              })}

              {free > 0 ? (
                <div
                  className="flex items-center justify-center rounded-lg border border-dashed border-cq-edge/60 text-[0.66rem] text-cq-muted"
                  style={{ flexGrow: free }}
                >
                  free
                </div>
              ) : null}
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* Incoming request                                              */}
          {/* ------------------------------------------------------------ */}
          <section className="rounded-xl border border-cq-edge/50 bg-cq-deep/40 p-3.5">
            {state.finished ? (
              <div className="text-center">
                <p className="font-display text-lg font-black text-cq-good">
                  All apps loaded 🎉
                </p>
                <p className="mt-1 text-[0.8rem] text-cq-muted">
                  You kept everything inside {TOTAL_RAM_GB} GB by closing what
                  you were not using.
                </p>
              </div>
            ) : state.incoming ? (
              <>
                <p className="mb-2 text-center text-[0.7rem] font-bold tracking-[0.14em] text-cq-muted uppercase">
                  Wants to open
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span aria-hidden="true" className="text-3xl">
                    {state.incoming.icon}
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-cq-ink">
                      {state.incoming.name}
                    </p>
                    <p className="text-[0.78rem] tabular-nums text-cq-muted">
                      needs {state.incoming.gb} GB
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleIncoming}
                    className="cq-button cq-button-primary text-[0.85rem]"
                  >
                    Open it
                  </button>
                </div>

                {/* The hint appears only when it will not fit, which is when
                    the lesson actually lands. */}
                {!incomingFits ? (
                  <p className="cq-rise mt-2.5 text-center text-[0.76rem] text-cq-warn">
                    Not enough free RAM. Close an app below to make room.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-center text-[0.8rem] text-cq-muted">
                Waiting for the next app…
              </p>
            )}
          </section>

          {/* ------------------------------------------------------------ */}
          {/* Resident apps — tap to close                                   */}
          {/* ------------------------------------------------------------ */}
          <section>
            <h3 className="mb-2 font-display text-[0.68rem] font-bold tracking-[0.16em] text-cq-muted uppercase">
              Open in RAM
              <span className="ml-2 font-normal normal-case">
                tap to close
              </span>
            </h3>

            {state.resident.length === 0 ? (
              <p className="rounded-lg border border-dashed border-cq-edge/50 px-3 py-4 text-center text-[0.78rem] text-cq-muted">
                Nothing is open. RAM is empty.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {state.resident.map((appId) => {
                  const app = APPS.find((candidate) => candidate.id === appId)
                  if (!app) return null
                  return (
                    <li key={appId}>
                      <button
                        type="button"
                        onClick={() => handleClose(appId)}
                        className="cq-button cq-button-ghost w-full justify-start !rounded-xl text-[0.8rem]"
                      >
                        <span aria-hidden="true">{app.icon}</span>
                        <span className="flex-1 text-left">{app.name}</span>
                        <span className="text-[0.68rem] tabular-nums text-cq-muted">
                          {app.gb}GB
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Feedback line — one short sentence, never a paragraph. */}
          {state.feedback && !state.finished ? (
            <p
              role="status"
              className={[
                'text-center text-[0.78rem]',
                state.feedback.tone === 'good' ? 'text-cq-good' : 'text-cq-warn',
              ].join(' ')}
            >
              {state.feedback.text}
            </p>
          ) : null}
        </div>

        {/* Footer summary */}
        <div className="flex items-center justify-between border-t border-cq-edge/60 bg-cq-deep/40 px-5 py-3">
          <p className="text-[0.72rem] text-cq-muted">
            Closing things you are not using is how real computers stay fast.
          </p>
          {state.finished ? (
            <button
              type="button"
              onClick={() => {
                reportResult(true)
                closeOverlay()
              }}
              className="cq-button cq-button-primary text-[0.85rem]"
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
