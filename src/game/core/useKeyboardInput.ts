import { useEffect } from 'react'
import { inputState } from './inputState'
import { KEY_BINDINGS, PREVENTED_KEYS } from '@/utils/input'

/**
 * Binds the keyboard to the shared input state. Mounted once, high in the
 * canvas tree. Touch input feeds the same state from the mobile controls, so
 * the player controller never knows which device is driving it (spec §10).
 */
export function useKeyboardInput(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      inputState.clear()
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Let the browser keep its shortcuts.
      if (event.ctrlKey || event.metaKey || event.altKey) return

      // Never steal keys while the player is typing in a field.
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return
      }

      const action = KEY_BINDINGS[event.code]
      if (!action) return

      if (PREVENTED_KEYS.has(event.code)) event.preventDefault()
      // Phones and some keyboards fire key repeat; ignore it so `consumePress`
      // only ever sees genuine presses.
      if (event.repeat) return

      inputState.press(action)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEY_BINDINGS[event.code]
      if (!action) return
      inputState.release(action)
    }

    // Losing focus mid-stride would otherwise leave the player running forever.
    const onBlur = () => inputState.clear()

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onBlur)
      inputState.clear()
    }
  }, [enabled])
}
