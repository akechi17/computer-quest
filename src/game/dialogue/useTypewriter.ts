import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/game/core/useReducedMotion'

/** Milliseconds between characters. Fast enough not to annoy a fast reader. */
const CHAR_INTERVAL_MS = 18

export interface TypewriterResult {
  /** The portion of the text revealed so far. */
  displayed: string
  isTyping: boolean
  /** Reveal the rest immediately (spec §15: "allow skipping typing animation"). */
  skip: () => void
}

/**
 * Reveals `text` one character at a time.
 *
 * Driven by an interval rather than requestAnimationFrame: text is not
 * frame-critical, and this keeps the animation running at a steady rate even
 * if the 3D scene drops frames.
 *
 * Respects the reduced-motion preference by revealing the text at once — a
 * per-character animation is exactly the kind of decorative motion that
 * setting exists to suppress (spec §32).
 */
export function useTypewriter(text: string): TypewriterResult {
  const reducedMotion = useReducedMotion()
  const [count, setCount] = useState(reducedMotion ? text.length : 0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (reducedMotion) {
      setCount(text.length)
      return
    }

    setCount(0)
    let index = 0

    intervalRef.current = window.setInterval(() => {
      index += 1
      setCount(index)
      if (index >= text.length && intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }, CHAR_INTERVAL_MS)

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [text, reducedMotion])

  const skip = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCount(text.length)
  }, [text])

  return {
    displayed: text.slice(0, count),
    isTyping: count < text.length,
    skip,
  }
}
