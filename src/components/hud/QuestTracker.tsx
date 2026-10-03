import { useMemo } from 'react'
import { QUEST_LIST } from '@/data/quests'
import { useProgressStore } from '@/stores/progressStore'
import type { QuestDefinition } from '@/data/types'

/**
 * Top-left quest tracker (spec §22).
 *
 * Shows only the active quest, and within it only the objectives the player
 * should currently see: completed ones get a tick, the current one is
 * emphasised, and future ones stay as empty boxes so the player can see the
 * shape of the job ahead without being told the answer.
 */
export function QuestTracker() {
  const questProgress = useProgressStore((s) => s.questProgress)

  const active = useMemo(() => {
    for (const quest of QUEST_LIST) {
      if (questProgress[quest.id]?.status === 'active') return quest
    }
    return null
  }, [questProgress])

  if (!active) return null

  const progress = questProgress[active.id]
  const completed = progress?.completedObjectiveIds ?? []

  // The first objective that is not yet done is the "current" one.
  const currentIndex = active.objectives.findIndex(
    (o) => !completed.includes(o.id),
  )

  return (
    <div className="cq-rise cq-panel pointer-events-none w-72 max-w-[70vw] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="text-base">
          📜
        </span>
        <h2 className="font-display text-[0.7rem] font-bold tracking-[0.18em] text-cq-muted uppercase">
          Quest
        </h2>
      </div>

      <p className="font-display text-[0.95rem] leading-snug font-bold text-cq-ink">
        {active.title}
      </p>

      <ul className="mt-3 space-y-1.5">
        {active.objectives.map((objective, index) => {
          const isDone = completed.includes(objective.id)
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <li
              key={objective.id}
              className={[
                'flex items-start gap-2 text-[0.8rem] leading-snug transition-opacity',
                isDone ? 'text-cq-good/80' : '',
                isCurrent ? 'text-cq-ink' : '',
                isFuture ? 'text-cq-muted/55' : '',
              ].join(' ')}
            >
              <ObjectiveMark done={isDone} current={isCurrent} />
              <span className={isDone ? 'line-through decoration-1' : ''}>
                {objective.label}
              </span>
            </li>
          )
        })}
      </ul>

      {/* The current objective's hint, so the player is never stuck without a
          nudge (spec §33: do not overwhelm, but do not abandon either). */}
      <CurrentHint quest={active} currentIndex={currentIndex} />
    </div>
  )
}

function CurrentHint({
  quest,
  currentIndex,
}: {
  quest: QuestDefinition
  currentIndex: number
}) {
  const objective = currentIndex >= 0 ? quest.objectives[currentIndex] : undefined
  if (!objective?.hint) return null

  return (
    <p className="cq-rise mt-3 border-t border-cq-edge/50 pt-2 text-[0.72rem] leading-snug text-cq-muted">
      <span aria-hidden="true">💡 </span>
      {objective.hint}
    </p>
  )
}

/**
 * Objective marker. Shape carries the state, not just colour — a tick, a
 * filled ring for current, an empty box for pending (spec §32).
 */
function ObjectiveMark({ done, current }: { done: boolean; current: boolean }) {
  if (done) {
    return (
      <span
        aria-label="completed"
        className="mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-cq-good text-[10px] font-black text-cq-night"
      >
        ✓
      </span>
    )
  }

  if (current) {
    return (
      <span
        aria-label="current objective"
        className="mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-[5px] border-2 border-cq-accent"
      >
        <span className="size-1.5 rounded-full bg-cq-accent" />
      </span>
    )
  }

  return (
    <span
      aria-label="not started"
      className="mt-[1px] size-4 shrink-0 rounded-[5px] border border-cq-edge"
    />
  )
}
