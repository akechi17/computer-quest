import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { LESSONS } from '@/data/lessons'
import { BADGES } from '@/data/badges'
import { questEvents } from '@/game/quests/questEvents'
import { useReducedMotion } from '@/game/core/useReducedMotion'

/**
 * The EXPLAIN step of the DISCOVER → INTERACT → EXPLAIN → PRACTICE → REWARD
 * loop (spec §12).
 *
 * The spec is explicit that lessons must not be long paragraphs and must end
 * with an action rather than a "Next" button. So this overlay:
 *   - leads with the icon and one short sentence,
 *   - shows scannable facts, revealed one at a time,
 *   - ends with a "Try this!" call to action when the lesson has practice.
 */
export function LessonOverlay() {
  const overlay = useSessionStore((s) => s.overlay)
  const closeOverlay = useSessionStore((s) => s.closeOverlay)
  const openOverlay = useSessionStore((s) => s.openOverlay)
  const reducedMotion = useReducedMotion()

  /* The lesson is chosen by the last `lesson-taught` event, which keeps this
     component from needing to know how the lesson was triggered. */
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [offerMinigame, setOfferMinigame] = useState(false)
  const [revealedFacts, setRevealedFacts] = useState(0)

  useEffect(() => {
    return questEvents.subscribe((event) => {
      if (event.type !== 'lesson-taught') return
      setLessonId(event.lessonId)
      setOfferMinigame(event.offerMinigame)
    })
  }, [])

  const lesson = lessonId ? LESSONS[lessonId] : undefined

  /* Reveal facts progressively so the overlay lands as a rhythm, not a wall. */
  useEffect(() => {
    if (overlay !== 'lesson' || !lesson) return
    setRevealedFacts(0)
    if (reducedMotion) {
      setRevealedFacts(lesson.facts.length)
      return
    }
    const timers = lesson.facts.map((_, index) =>
      window.setTimeout(() => setRevealedFacts(index + 1), 260 * (index + 1)),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [overlay, lesson, reducedMotion])

  /* Escape closes the overlay (spec §32: keyboard navigation for menus). */
  useEffect(() => {
    if (overlay !== 'lesson') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        closeOverlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [overlay, closeOverlay])

  const isFirstTime = useProgressStore((s) =>
    lesson ? !s.completedLessonIds.includes(lesson.id) : false,
  )

  const badge = useMemo(
    () => (lesson?.badgeId ? BADGES[lesson.badgeId] : undefined),
    [lesson],
  )

  if (overlay !== 'lesson' || !lesson) return null

  const allFactsShown = revealedFacts >= lesson.facts.length

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cq-night/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-title"
        className="cq-panel-solid cq-pop w-full max-w-lg overflow-hidden"
      >
        {/* Header band */}
        <div className="flex items-center gap-3 border-b border-cq-edge/60 bg-cq-deep/60 px-5 py-4">
          <span aria-hidden="true" className="text-3xl">
            {lesson.icon}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[0.65rem] font-bold tracking-[0.2em] text-cq-muted uppercase">
              Discovered
            </p>
            <h2
              id="lesson-title"
              className="font-display text-xl leading-tight font-black text-cq-ink"
            >
              {lesson.title}
            </h2>
          </div>
        </div>

        <div className="px-5 py-4">
          {/* One short explanation, never a paragraph dump. */}
          <p className="text-[0.95rem] leading-relaxed text-cq-ink">
            {lesson.explanation}
          </p>

          {/* Facts, revealed in sequence. */}
          <ul className="mt-4 space-y-2">
            {lesson.facts.slice(0, revealedFacts).map((fact) => (
              <li
                key={fact}
                className="cq-rise flex items-start gap-2.5 text-[0.875rem] leading-snug text-cq-muted"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rotate-45 rounded-[2px] bg-cq-accent"
                />
                {fact}
              </li>
            ))}
          </ul>

          {/* Reward line — XP only shows the first time, so the overlay never
              implies repeatable XP. */}
          {isFirstTime ? (
            <div className="mt-4 flex items-center gap-3 border-t border-cq-edge/50 pt-3">
              <span className="flex items-center gap-1.5 rounded-full bg-cq-gold/15 px-3 py-1 text-[0.78rem] font-bold text-cq-gold">
                <span aria-hidden="true">⭐</span>+{lesson.xp} XP
              </span>
              {badge ? (
                <span className="flex items-center gap-1.5 rounded-full bg-cq-accent/15 px-3 py-1 text-[0.78rem] font-bold text-cq-accent">
                  <span aria-hidden="true">{badge.icon}</span>
                  {badge.name}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 border-t border-cq-edge/50 pt-3 text-[0.75rem] text-cq-muted">
              Already discovered — no extra XP this time.
            </p>
          )}
        </div>

        {/* Action row. "Try this!" opens the practice step instead of closing,
            which is the spec's requirement that interaction beat a Next button. */}
        <div className="flex items-center justify-end gap-2 border-t border-cq-edge/60 bg-cq-deep/40 px-5 py-3.5">
          <button
            type="button"
            onClick={closeOverlay}
            disabled={!allFactsShown}
            className="cq-button cq-button-ghost text-[0.85rem]"
          >
            Got it
          </button>

          {offerMinigame && lesson.minigameId ? (
            <button
              type="button"
              onClick={() => openOverlay('minigame')}
              disabled={!allFactsShown}
              className="cq-button cq-button-primary text-[0.85rem]"
            >
              <span aria-hidden="true">🎮</span> Try this!
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
