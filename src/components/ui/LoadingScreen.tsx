import { useEffect, useState } from 'react'
import { useAssetLoading } from '@/game/core/assets'

/**
 * The loading experience (spec §30).
 *
 * Rules taken directly from the spec:
 *   - never show a blank screen,
 *   - show the title, the current stage, and a real bar,
 *   - if an asset fails, say so and continue with a fallback rather than
 *     crashing.
 */
export function LoadingScreen({ onReady }: { onReady: () => void }) {
  /* The world is procedural, so there is nothing to fetch — the "loading" is
     scene warm-up. We hold the bar briefly so it reads as a deliberate beat
     rather than a flicker. */
  const [worldReady, setWorldReady] = useState(false)
  const status = useAssetLoading(worldReady)

  useEffect(() => {
    const timeout = window.setTimeout(() => setWorldReady(true), 900)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!status.done) return
    const timeout = window.setTimeout(onReady, 260)
    return () => window.clearTimeout(timeout)
  }, [status.done, onReady])

  const percent = Math.round(status.progress * 100)
  /* 18 cells, so the bar matches the ASCII sketch in the spec's spirit while
     remaining crisp at any width. */
  const filled = Math.round(status.progress * 18)

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-cq-night">
      {/* Title */}
      <div className="text-center">
        <p className="font-display text-[0.7rem] font-bold tracking-[0.35em] text-cq-accent uppercase">
          Computer
        </p>
        <h1 className="font-display text-4xl font-black tracking-tight text-cq-ink sm:text-5xl">
          Quest
        </h1>
      </div>

      {/* Bar */}
      <div className="mt-8 w-72 max-w-[80vw]">
        <p className="mb-2 text-center text-[0.78rem] text-cq-muted">
          {status.stage}
        </p>

        <div
          className="h-3 overflow-hidden rounded-full border border-cq-edge bg-cq-deep"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Loading the world"
        >
          <div className="flex h-full gap-[2px] p-[2px]">
            {Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                className={[
                  'flex-1 rounded-[2px] transition-colors duration-300',
                  i < filled ? 'bg-cq-accent' : 'bg-cq-edge/40',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        <p className="mt-2 text-center text-[0.7rem] tabular-nums text-cq-muted">
          {percent}%
        </p>
      </div>

      {/* Graceful failure notice — the game still starts. */}
      {status.error ? (
        <p
          role="alert"
          className="cq-rise mt-5 max-w-sm rounded-xl border border-cq-warn/40 bg-cq-warn/10 px-4 py-2.5 text-center text-[0.75rem] text-cq-warn"
        >
          {status.error}
        </p>
      ) : null}
    </div>
  )
}
