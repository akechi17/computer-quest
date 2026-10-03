import { useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { BADGE_LIST, LEVEL_TIERS } from '@/data/badges'
import { ITEMS } from '@/data/items'
import { LESSON_LIST } from '@/data/lessons'
import { QUEST_LIST } from '@/data/quests'

/**
 * The player's profile: badges, inventory and educational progress (spec §25
 * says badges are displayed here, §27 says lessons are part of the save).
 */
export function ProfilePanel() {
  const overlay = useSessionStore((s) => s.overlay)
  const closeOverlay = useSessionStore((s) => s.closeOverlay)

  const badges = useProgressStore((s) => s.badges)
  const inventory = useProgressStore((s) => s.inventory)
  const completedLessonIds = useProgressStore((s) => s.completedLessonIds)
  const questProgress = useProgressStore((s) => s.questProgress)
  const level = useProgressStore((s) => s.level)()
  const levelTitle = useProgressStore((s) => s.levelTitle)()
  const xp = useProgressStore((s) => s.xp)
  const playSeconds = useProgressStore((s) => s.playSeconds)

  useEffect(() => {
    if (overlay !== 'profile') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        closeOverlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [overlay, closeOverlay])

  if (overlay !== 'profile') return null

  const ownedItems = inventory.filter((entry) => ITEMS[entry.itemId])
  const lessonsDone = completedLessonIds.length
  const questsDone = QUEST_LIST.filter(
    (quest) => questProgress[quest.id]?.status === 'complete',
  ).length

  return (
    <Modal title="Explorer Profile" onClose={closeOverlay}>
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Level" value={String(level)} sub={levelTitle} />
        <Stat label="Total XP" value={String(xp)} />
        <Stat label="Badges" value={`${badges.length}/${BADGE_LIST.length}`} />
        <Stat
          label="Play time"
          value={formatDuration(playSeconds)}
        />
      </div>

      {/* Badges */}
      <Section title={`Badges (${badges.length}/${BADGE_LIST.length})`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGE_LIST.map((badge) => {
            const earned = badges.includes(badge.id)
            return (
              <div
                key={badge.id}
                className={[
                  'rounded-xl border p-2.5 text-center transition-opacity',
                  earned
                    ? 'border-cq-accent/40 bg-cq-accent/10'
                    : 'border-cq-edge/40 bg-cq-deep/40 opacity-45',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={['block text-2xl', earned ? '' : 'grayscale'].join(' ')}
                >
                  {badge.icon}
                </span>
                <p className="mt-1 font-display text-[0.75rem] leading-tight font-bold text-cq-ink">
                  {badge.name}
                </p>
                {/* Locked badges state their requirement rather than hiding it,
                    so the player knows what to look for. */}
                <p className="mt-0.5 text-[0.65rem] leading-snug text-cq-muted">
                  {earned ? 'Earned' : badge.description}
                </p>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Lessons */}
      <Section title={`Lessons learned (${lessonsDone}/${LESSON_LIST.length})`}>
        <ul className="space-y-1.5">
          {LESSON_LIST.map((lesson) => {
            const done = completedLessonIds.includes(lesson.id)
            return (
              <li
                key={lesson.id}
                className="flex items-center gap-2.5 text-[0.8rem] text-cq-muted"
              >
                <span
                  aria-hidden="true"
                  className={[
                    'flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black',
                    done ? 'bg-cq-good text-cq-night' : 'border border-cq-edge',
                  ].join(' ')}
                >
                  {done ? '✓' : ''}
                </span>
                <span aria-hidden="true">{lesson.icon}</span>
                <span className={done ? 'text-cq-ink' : ''}>{lesson.title}</span>
              </li>
            )
          })}
        </ul>
      </Section>

      {/* Inventory */}
      <Section title={`Inventory (${ownedItems.length})`}>
        {ownedItems.length === 0 ? (
          <p className="text-[0.78rem] text-cq-muted">
            Nothing yet. Explore the village and pick things up.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {ownedItems.map((entry) => {
              const item = ITEMS[entry.itemId]
              if (!item) return null
              return (
                <li
                  key={entry.itemId}
                  className="flex items-center gap-2.5 rounded-lg border border-cq-edge/40 bg-cq-deep/40 px-2.5 py-2"
                >
                  <span aria-hidden="true" className="text-lg">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8rem] font-semibold text-cq-ink">
                      {item.name}
                      {entry.quantity > 1 ? (
                        <span className="ml-1 text-cq-muted">
                          ×{entry.quantity}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[0.68rem] leading-snug text-cq-muted">
                      {item.description}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <p className="text-[0.7rem] text-cq-muted">
        Quests completed: {questsDone}/{QUEST_LIST.length} · Levels available:{' '}
        {LEVEL_TIERS.length}
      </p>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cq-night/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="cq-panel-solid cq-pop flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-cq-edge/60 px-5 py-4">
          <h2 className="font-display text-xl font-black text-cq-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cq-button cq-button-ghost !px-3 !py-1.5 text-[0.78rem]"
          >
            Close
            <kbd className="ml-1 rounded border border-cq-edge px-1.5 py-0.5 text-[0.62rem]">
              Esc
            </kbd>
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2.5 font-display text-[0.65rem] font-bold tracking-[0.18em] text-cq-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-cq-edge/40 bg-cq-deep/40 px-3 py-2">
      <p className="text-[0.62rem] font-bold tracking-[0.14em] text-cq-muted uppercase">
        {label}
      </p>
      <p className="font-display text-lg leading-tight font-black text-cq-ink">
        {value}
      </p>
      {sub ? (
        <p className="truncate text-[0.65rem] text-cq-muted">{sub}</p>
      ) : null}
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
