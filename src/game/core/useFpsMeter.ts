import { useEffect, useState } from 'react'

/**
 * A lightweight frame-rate sampler for the optional on-screen counter
 * (spec §29 — it helps a player on a weak machine find the right quality
 * preset, which is why it is exposed in settings rather than being dev-only).
 */
export function useFpsMeter(enabled: boolean): number {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let frames = 0
    let lastSample = performance.now()
    let raf = 0

    const tick = () => {
      frames += 1
      const now = performance.now()
      const elapsed = now - lastSample

      // Sample once a second: frequent enough to be useful, rare enough that
      // the counter itself does not become the performance problem.
      if (elapsed >= 1000) {
        setFps(Math.round((frames * 1000) / elapsed))
        frames = 0
        lastSample = now
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  return fps
}
