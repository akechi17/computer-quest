import { useSettingsStore } from '@/stores/settingsStore'
import { useFpsMeter } from '@/game/core/useFpsMeter'
import { useInteractionStore } from '@/game/interaction/interactionStore'
import { useProgressStore } from '@/stores/progressStore'

/**
 * An opt-in diagnostics readout, enabled from the pause menu's "Show frame
 * rate" toggle. It shows a little more than FPS because the extra numbers are
 * what actually diagnose a slow scene.
 */
export function DevOverlay() {
  const showFps = useSettingsStore((s) => s.showFps)
  const fps = useFpsMeter(showFps)

  const nearest = useInteractionStore((s) => s.nearest)
  const xp = useProgressStore((s) => s.xp)
  const level = useProgressStore((s) => s.level)()

  if (!showFps) return null

  return (
    <div className="pointer-events-none absolute bottom-2 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-cq-night/85 px-3 py-1.5 font-mono text-[0.68rem] text-cq-muted backdrop-blur-sm">
      <span className="text-cq-good">{fps} fps</span>
      <span className="mx-2 opacity-40">|</span>
      lvl {level} · {xp} xp
      <span className="mx-2 opacity-40">|</span>
      {nearest ? nearest.id : 'no target'}
    </div>
  )
}
