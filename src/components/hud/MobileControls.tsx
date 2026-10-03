import { useCallback, useEffect, useRef, useState } from 'react'
import { inputState } from '@/game/core/inputState'
import { interactTrigger } from '@/game/interaction/useInteractionHandler'
import { useInteractionStore } from '@/game/interaction/interactionStore'
import { useSessionStore } from '@/stores/sessionStore'
import { isTouchDevice } from '@/game/core/device'

/**
 * Touch controls (spec §10).
 *
 * These do not implement movement — they feed the *same* `inputState` the
 * keyboard writes to, so the player controller is unaware of the device. That
 * is the whole point of the input abstraction.
 *
 * Rendered only on touch devices so the desktop experience is uncluttered.
 */

/** Radius of the joystick base, in CSS pixels. */
const STICK_RADIUS = 56

export function MobileControls() {
  const [touch, setTouch] = useState(false)

  useEffect(() => {
    setTouch(isTouchDevice())
  }, [])

  const blocked = useSessionStore((s) => s.isInputBlocked)
  const nearby = useInteractionStore((s) => s.nearest)

  if (!touch) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      // The controls own their pointer events; the canvas keeps the rest so
      // dragging anywhere else still orbits the camera.
    >
      <Joystick disabled={blocked()} />

      {/* Action buttons, bottom-right */}
      <div className="pointer-events-auto absolute right-4 bottom-6 flex flex-col items-end gap-3">
        <ActionButton
          label="Interact"
          icon={nearby?.definition.icon ?? '👆'}
          disabled={blocked() || !nearby}
          onPress={() => interactTrigger.fire()}
          primary
        />
        <div className="flex gap-3">
          <ActionButton
            label="Jump"
            icon="⤒"
            disabled={blocked()}
            onPress={() => inputState.press('jump')}
            onRelease={() => inputState.release('jump')}
          />
          <ActionButton
            label="Run"
            icon="»"
            disabled={blocked()}
            onPress={() => inputState.press('run')}
            onRelease={() => inputState.release('run')}
          />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Joystick                                                                    */
/* -------------------------------------------------------------------------- */

function Joystick({ disabled }: { disabled: boolean }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const activeId = useRef<number | null>(null)

  const update = useCallback((clientX: number, clientY: number) => {
    const element = base.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const centreX = rect.left + rect.width / 2
    const centreY = rect.top + rect.height / 2

    let dx = clientX - centreX
    let dy = clientY - centreY

    const distance = Math.hypot(dx, dy)
    if (distance > STICK_RADIUS) {
      dx = (dx / distance) * STICK_RADIUS
      dy = (dy / distance) * STICK_RADIUS
    }

    setKnob({ x: dx, y: dy })
    // Screen-up is negative Y, but `moveAxis` treats +y as forward.
    inputState.setStick(dx / STICK_RADIUS, -dy / STICK_RADIUS)
  }, [])

  const release = useCallback(() => {
    activeId.current = null
    setKnob({ x: 0, y: 0 })
    inputState.setStick(0, 0)
  }, [])

  useEffect(() => {
    if (disabled) release()
  }, [disabled, release])

  return (
    <div
      ref={base}
      className="pointer-events-auto absolute bottom-6 left-4 size-32 touch-none rounded-full border border-cq-edge/60 bg-cq-panel/40 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (disabled) return
        activeId.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (activeId.current !== event.pointerId) return
        update(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        if (activeId.current !== event.pointerId) return
        release()
      }}
      onPointerCancel={release}
      role="group"
      aria-label="Movement joystick"
    >
      {/* Directional ticks, so the control reads as a joystick even at rest */}
      {[
        { top: 6, left: '50%', rotate: 0 },
        { bottom: 6, left: '50%', rotate: 180 },
        { left: 6, top: '50%', rotate: -90 },
        { right: 6, top: '50%', rotate: 90 },
      ].map((pos, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute text-[10px] text-cq-muted/60"
          style={{
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            right: pos.right,
            transform: `translate(-50%, -50%) rotate(${pos.rotate}deg)`,
          }}
        >
          ▲
        </span>
      ))}

      <div
        className="absolute top-1/2 left-1/2 size-14 rounded-full border border-cq-accent/60 bg-cq-accent/25 backdrop-blur-sm transition-transform duration-75"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Action button                                                               */
/* -------------------------------------------------------------------------- */

function ActionButton({
  label,
  icon,
  disabled,
  onPress,
  onRelease,
  primary = false,
}: {
  label: string
  icon: string
  disabled: boolean
  onPress: () => void
  onRelease?: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={[
        'flex touch-none items-center justify-center rounded-full border backdrop-blur-sm transition-transform active:scale-95',
        primary ? 'size-18 text-2xl' : 'size-14 text-lg',
        disabled
          ? 'border-cq-edge/40 bg-cq-panel/25 opacity-40'
          : primary
            ? 'border-cq-accent/60 bg-cq-accent/25'
            : 'border-cq-edge/60 bg-cq-panel/40',
      ].join(' ')}
      onPointerDown={(event) => {
        event.preventDefault()
        if (disabled) return
        onPress()
      }}
      onPointerUp={() => {
        if (disabled) return
        onRelease?.()
      }}
      onPointerLeave={() => {
        if (disabled) return
        onRelease?.()
      }}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
