import { useEffect, type ReactNode } from 'react'
import { useSettingsStore, applySettingsToDom } from '@/stores/settingsStore'
import { useFpsMeter } from '@/game/core/useFpsMeter'
import { DevOverlay } from '@/components/dev/DevOverlay'

/**
 * Cross-cutting concerns that must run for the whole app: pushing settings
 * onto the document, and the optional frame-rate readout.
 *
 * Mounted above the router so a settings change on the title screen applies to
 * the game canvas too.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const highContrast = useSettingsStore((s) => s.highContrast)
  const reducedMotion = useSettingsStore((s) => s.reducedMotion)
  const textScale = useSettingsStore((s) => s.textScale)
  const showFps = useSettingsStore((s) => s.showFps)

  useFpsMeter(showFps)

  /* Mirror the accessibility settings onto <html> so CSS can act on them
     without every component subscribing to the store. */
  useEffect(() => {
    applySettingsToDom({ highContrast, reducedMotion, textScale })
  }, [highContrast, reducedMotion, textScale])

  return (
    <>
      {children}
      <DevOverlay />
    </>
  )
}
