import { useEffect, useRef } from 'react'
import { useProgressStore } from '@/stores/progressStore'

/**
 * Accumulates play time into the progress snapshot once a minute, rather than
 * every frame — writing to a persisted store at 60fps would thrash
 * localStorage (spec §29).
 */
export function useGameClock(enabled: boolean): void {
  const addPlayTime = useProgressStore((s) => s.addPlayTime)
  const accumulated = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const interval = window.setInterval(() => {
      accumulated.current += 60
      if (accumulated.current >= 60) {
        addPlayTime(accumulated.current)
        accumulated.current = 0
      }
    }, 60_000)

    return () => {
      window.clearInterval(interval)
      // Flush whatever fraction of a minute is left so nothing is lost.
      if (accumulated.current > 0) {
        addPlayTime(accumulated.current)
        accumulated.current = 0
      }
    }
  }, [enabled, addPlayTime])
}
