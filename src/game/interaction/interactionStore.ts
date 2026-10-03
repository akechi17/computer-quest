import { create } from 'zustand'
import type { InteractiveDefinition } from '@/data/types'

/**
 * Which interactable the player is currently close enough to use.
 *
 * This is deliberately a tiny store rather than React state in the detector:
 * the HUD's prompt, the mobile interact button and the audio system all need
 * to react to it, and they live in different subtrees.
 */

export type InteractionSource = 'npc' | 'object'

export interface InteractionCandidate {
  /** Namespaced id, matching the objective `target` for quests. */
  id: string
  definition: InteractiveDefinition
  source: InteractionSource
  /** Display name of the NPC, when the source is an NPC. */
  npcName?: string
  npcRole?: string
  /** Direct handler for NPCs, which are not part of the data-driven list. */
  dialogueId?: string
  distance: number
}

export interface InteractionState {
  /** The nearest candidate, or null when nothing is in range. */
  nearest: InteractionCandidate | null
  /** True while an interaction handler is running (blocks re-entry). */
  busy: boolean

  setNearest: (candidate: InteractionCandidate | null) => void
  setBusy: (busy: boolean) => void
  clear: () => void
}

export const useInteractionStore = create<InteractionState>()((set) => ({
  nearest: null,
  busy: false,

  setNearest: (candidate) =>
    set((s) => {
      // Avoid a re-render every frame when the same object stays in range.
      if (s.nearest?.id === candidate?.id && candidate !== null) return s
      if (s.nearest === null && candidate === null) return s
      return { nearest: candidate }
    }),

  setBusy: (busy) => set({ busy }),
  clear: () => set({ nearest: null, busy: false }),
}))
