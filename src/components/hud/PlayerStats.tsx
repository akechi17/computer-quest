import { useEffect, useRef, useState } from 'react'
import { useProgressStore } from '@/stores/progressStore'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Bottom-left status: level, XP bar and coins (spec §22).
 *
 * Health is not modelled in the MVP — there is no combat and the spec's
 * priority list puts learning first — so the panel shows level and XP, which
 * are the numbers that actually mean something here.
 */
export function PlayerStats() {
  const xp = useProgressStore((s) => s.xp)
  const coins = useProgressStore((s) => s.coins)
  const level = useProgressStore((s) => s.level)()
  const levelTitle = useProgressStore((s) => s.levelTitle)()

  const openOverlay = useSessionStore((s) => s.openOverlay)

  /* Level-up flourish. We track the previous level so the pulse only fires on
     an actual change, not on every render. */
  const previousLevel = useRef(level)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    if (level > previousLevel.current) {
      setCelebrating(true)
      const timeout = window.setTimeout(() => setCelebrating(false), 2400)
      previousLevel.current = level
      return () => window.clearTimeout(timeout)
    }
    previousLevel.current = level
    return undefined
  }, [level])

  /* XP progress within the current level, for the bar. */
  const xpInto = useProgressStore((s) => s.xpIntoLevel)()
  const xpForNext = useProgressStore((s) => s.xpForNextLevel)()
  const ratio = xpForNext && xpForNext > 0 ? Math.min(xpInto / xpForNext, 1) : 1

  return (
    <div className="cq-rise cq-panel w-60 max-w-[65vw] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-gradient-to-b from-cq-accent to-cq-accent-deep font-display text-sm font-black text-cq-night"
          >
            {level}
          </span>
          <div className="leading-tight">
            <p className="font-display text-[0.8rem] font-bold text-cq-ink">
              {levelTitle}
            </p>
            <p className="text-[0.68rem] text-cq-muted">Level {level}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openOverlay('profile')}
          className="cq-button cq-button-ghost !px-2 !py-1 text-[0.7rem]"
          aria-label="Open profile"
        >
          🎒
        </button>
      </div>

      {/* XP bar */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-baseline justify-between text-[0.68rem]">
          <span className="flex items-center gap-1 text-cq-gold">
            <span aria-hidden="true">⭐</span>
            <span className="tabular-nums font-semibold">{xp} XP</span>
          </span>
          {xpForNext ? (
            <span className="tabular-nums text-cq-muted">
              {xpInto}/{xpForNext}
            </span>
          ) : (
            <span className="text-cq-muted">Max</span>
          )}
        </div>

        {/* The bar has a text label, so progress is never colour-only. */}
        <div
          className="h-2 overflow-hidden rounded-full bg-cq-night/70"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={xpForNext ?? 100}
          aria-valuenow={xpInto}
          aria-label={`Experience toward ${
            xpForNext ? 'the next level' : 'maximum level'
          }`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cq-accent to-cq-gold transition-[width] duration-500 ease-out"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[0.7rem] text-cq-muted">
        <span aria-hidden="true">🪙</span>
        <span className="tabular-nums font-semibold text-cq-ink">{coins}</span>
        <span>coins</span>
      </div>

      {celebrating ? <LevelUpBanner title={levelTitle} level={level} /> : null}
    </div>
  )
}

function LevelUpBanner({ title, level }: { title: string; level: number }) {
  return (
    <div
      role="status"
      className="cq-panel-solid cq-pop absolute -top-2 left-0 w-full -translate-y-full p-3 text-center"
    >
      <p className="font-display text-[0.68rem] font-bold tracking-[0.2em] text-cq-gold uppercase">
        Level up
      </p>
      <p className="font-display text-sm font-black text-cq-ink">
        {title}
      </p>
      <p className="text-[0.68rem] text-cq-muted">You are now level {level}</p>
    </div>
  )
}
