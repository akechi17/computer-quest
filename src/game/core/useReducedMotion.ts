import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * True when decorative motion should be suppressed (spec §32).
 *
 * Combines the in-game setting with the OS-level `prefers-reduced-motion`
 * query, so a player who has already told their operating system they want
 * less motion gets it without hunting through a menu.
 */
export function useReducedMotion(): boolean {
  const setting = useSettingsStore((s) => s.reducedMotion)

  const [systemPrefers, setSystemPrefers] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => setSystemPrefers(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (setting === 'reduced') return true
  // An explicit "full" in settings overrides the system preference.
  if (setting === 'full') return systemPrefers && false
  return systemPrefers
}
