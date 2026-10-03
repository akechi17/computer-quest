import { useFrame } from '@react-three/fiber'
import { NPC_LIST } from '@/data/world'
import { INTERACTIVES, radiusFor } from '@/data/world'
import { INTERACTION } from '@/utils/constants'
import { distance2D } from '@/utils/math'
import { playerTransform } from '@/game/core/playerTransform'
import { useInteractionStore, type InteractionCandidate } from './interactionStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { visibleInteractives } from '@/game/interaction/visibility'

/**
 * Runs once per frame and publishes the nearest usable interactable.
 *
 * Design notes:
 *  - It writes to a store that only notifies when the *nearest id* changes,
 *    so walking around does not cause a React re-render every frame.
 *  - Candidate selection prefers whatever the player is facing, not merely the
 *    closest thing, so standing between two objects is not a coin flip.
 */

/** How often the expensive visibility filter is recomputed, in seconds. */
const VISIBILITY_INTERVAL = 0.25

let visibilityAccumulator = VISIBILITY_INTERVAL
let cachedVisible: Set<string> = new Set()

export function useInteractionDetector(enabled: boolean): void {
  const setNearest = useInteractionStore((s) => s.setNearest)

  useFrame((_, rawDelta) => {
    if (!enabled) {
      setNearest(null)
      return
    }

    const delta = Math.min(rawDelta, 1 / 20)
    visibilityAccumulator += delta
    if (visibilityAccumulator >= VISIBILITY_INTERVAL) {
      visibilityAccumulator = 0
      cachedVisible = visibleInteractives(
        useProgressStore.getState(),
        Object.values(INTERACTIVES),
      )
    }

    const px = playerTransform.position.x
    const pz = playerTransform.position.z
    const heading = playerTransform.heading

    // Forward vector for the facing bias.
    const forwardX = -Math.sin(heading)
    const forwardZ = -Math.cos(heading)

    let best: InteractionCandidate | null = null
    let bestScore = -Infinity

    /* -- Objects ------------------------------------------------------- */
    for (const definition of Object.values(INTERACTIVES)) {
      if (!cachedVisible.has(definition.id)) continue

      const [ox, , oz] = definition.position
      const distance = distance2D(px, pz, ox, oz)
      const radius = radiusFor(definition)
      if (distance > radius) continue

      const score = scoreCandidate(distance, radius, px, pz, forwardX, forwardZ, ox, oz)
      if (score > bestScore) {
        bestScore = score
        best = { id: definition.id, definition, source: 'object', distance }
      }
    }

    /* -- NPCs ---------------------------------------------------------- */
    for (const npc of Object.values(NPC_LIST)) {
      const [nx, , nz] = npc.position
      const distance = distance2D(px, pz, nx, nz)
      if (distance > INTERACTION.NPC_RADIUS) continue

      const score =
        scoreCandidate(
          distance,
          INTERACTION.NPC_RADIUS,
          px,
          pz,
          forwardX,
          forwardZ,
          nx,
          nz,
        ) + 0.35 // NPCs win ties — they are usually what the player wants.

      if (score > bestScore) {
        bestScore = score
        best = {
          id: npc.id,
          source: 'npc',
          npcName: npc.name,
          npcRole: npc.role,
          dialogueId: npc.dialogueId,
          definition: {
            id: npc.id,
            label: npc.name,
            verb: 'Talk to',
            kind: 'npc',
            position: npc.position,
            icon: '💬',
            radius: INTERACTION.NPC_RADIUS,
          },
          distance,
        }
      }
    }

    setNearest(best)

  })
}

/**
 * Higher is better. Being close matters, but facing the object matters more —
 * this is what stops the prompt flickering between two objects at similar
 * range.
 */
function scoreCandidate(
  distance: number,
  radius: number,
  px: number,
  pz: number,
  forwardX: number,
  forwardZ: number,
  ox: number,
  oz: number,
): number {
  const toObjectX = ox - px
  const toObjectZ = oz - pz
  const length = Math.hypot(toObjectX, toObjectZ)
  if (length < 0.0001) return 1

  const dot = (toObjectX / length) * forwardX + (toObjectZ / length) * forwardZ

  // Closeness contributes 0..1, facing contributes 0..1.5.
  const closeness = 1 - distance / radius
  const facing = (dot + 1) / 2

  // Objects behind the player are heavily penalised but not excluded, so a
  // player who backs into something can still use it.
  const facingWeight = dot < INTERACTION.FACING_DOT_MIN ? 0.15 : 1

  return closeness + facing * 1.5 * facingWeight
}

/** Called by the pause/menu layer to drop the prompt immediately. */
export function resetInteractionDetection(): void {
  visibilityAccumulator = VISIBILITY_INTERVAL
  cachedVisible = new Set()
  useInteractionStore.getState().clear()
  void useSessionStore
}
