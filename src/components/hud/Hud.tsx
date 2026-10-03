import { useSessionStore } from '@/stores/sessionStore'
import { QuestTracker } from './QuestTracker'
import { PlayerStats } from './PlayerStats'
import { InteractionPrompt } from './InteractionPrompt'
import { MobileControls } from './MobileControls'
import { XpToasts } from './XpToasts'
import { TutorialHints } from './TutorialHints'
import { PauseButton } from './PauseButton'
import { isTouchDevice } from '@/game/core/device'

/**
 * The in-game HUD (spec §22).
 *
 * Layout follows the spec's sketch: quest top-left, stats bottom-left,
 * interaction prompt bottom-right. Everything is `pointer-events-none` by
 * default so the canvas keeps mouse control; only genuinely clickable
 * elements opt back in.
 */
export function Hud() {
  const started = useSessionStore((s) => s.started)

  if (!started) return null

  const touch = isTouchDevice()

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* Top-left: quest tracker */}
      <div className="absolute top-4 left-4">
        <QuestTracker />
      </div>

      {/* Top-right: pause and map */}
      <div className="pointer-events-auto absolute top-4 right-4 flex gap-2">
        <PauseButton />
      </div>

      {/* Bottom-left: level, XP, coins */}
      <div className="absolute bottom-4 left-4">
        <PlayerStats />
      </div>

      {/* Bottom-right: interaction prompt. On touch, the joystick and action
          buttons occupy this area, so the prompt moves up instead. */}
      <div
        className={[
          'absolute right-4',
          touch ? 'bottom-52' : 'bottom-6',
        ].join(' ')}
      >
        <InteractionPrompt />
      </div>

      {/* Transient feedback */}
      <div className="absolute top-20 right-4">
        <XpToasts />
      </div>

      {/* First-run control hints */}
      <TutorialHints />

      {/* Touch controls, which opt into pointer events themselves */}
      <MobileControls />
    </div>
  )
}
