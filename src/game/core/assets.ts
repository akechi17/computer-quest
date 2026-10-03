import { useProgress } from '@react-three/drei'

/**
 * Asset loading strategy (spec §29, §30).
 *
 * The MVP draws the world entirely from procedural geometry, so there is no
 * network fetch to await — but the loading screen must still exist and must
 * still be honest. It therefore reports two things:
 *
 *   1. Real progress from drei/r3f's loader while any GLB is in flight.
 *   2. A short, fixed "world build" stage, because the first frames of a
 *      React Three Fiber scene compile shaders and would otherwise look like
 *      a freeze.
 *
 * When GLB assets are added later they are picked up by (1) automatically.
 */

export interface LoadingStatus {
  /** 0..1 */
  progress: number
  /** Player-facing description of the current stage. */
  stage: string
  done: boolean
  /** Non-null when an asset failed; the UI shows a fallback rather than crashing. */
  error: string | null
}

export const LOADING_STAGES = [
  'Waking up the village...',
  'Charging the capacitors...',
  'Polishing the pixels...',
  'Preparing the world...',
] as const

/** Wraps drei's loader with the world-build stage so the bar never sits at 0. */
export function useAssetLoading(worldReady: boolean): LoadingStatus {
  const { progress: gltfProgress, errors } = useProgress()

  const gltfFraction = gltfProgress / 100
  // Reserve the last 20% of the bar for scene warm-up.
  const combined = worldReady ? 1 : Math.min(gltfFraction * 0.8, 0.8)

  const stageIndex = worldReady
    ? LOADING_STAGES.length - 1
    : Math.min(
        Math.floor(combined * LOADING_STAGES.length),
        LOADING_STAGES.length - 1,
      )

  const error =
    errors.length > 0
      ? `Some 3D assets could not be loaded (${errors.length}). The world will use simplified shapes.`
      : null

  return {
    progress: combined,
    stage: LOADING_STAGES[stageIndex] ?? LOADING_STAGES[0],
    done: combined >= 1,
    error,
  }
}
