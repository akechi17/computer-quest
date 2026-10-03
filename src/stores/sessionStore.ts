import { create } from 'zustand'
import { getDialogue } from '@/data/dialogues'

/**
 * Ephemeral session state: things that should NOT survive a page reload and
 * should never end up in a save file. Keeping this separate from
 * `progressStore` is what makes the save system cheap (spec §5, §27).
 */

export type OverlayKind = 'none' | 'lesson' | 'minigame' | 'map' | 'profile'

export interface DialogueRuntime {
  treeId: string
  nodeId: string
  /** Which NPC or object is speaking, for portrait/label context. */
  sourceId: string
}

export interface SessionState {
  /** True once the player leaves the title screen. */
  started: boolean
  paused: boolean
  overlay: OverlayKind

  /* Dialogue */
  dialogue: DialogueRuntime | null
  /**
   * Opens a conversation at the tree's own root node.
   *
   * The root is read from the tree rather than passed in: every dialogue to
   * date declares it under a different name (`greet`, `found`, `works`...),
   * so accepting a node id here invites callers to guess one that does not
   * exist — which renders an empty dialogue that still blocks input, trapping
   * the player. Resolving it centrally makes that mistake impossible.
   */
  startDialogue: (treeId: string, sourceId: string) => void
  goToDialogueNode: (nodeId: string) => void
  endDialogue: () => void

  /* Overlays */
  openOverlay: (kind: Exclude<OverlayKind, 'none'>) => void
  closeOverlay: () => void

  /* Pause */
  setPaused: (paused: boolean) => void
  togglePaused: () => void

  /* Lifecycle */
  beginGame: () => void

  /**
   * UI blocks gameplay whenever any of these are true. The player controller
   * reads this instead of each UI component reaching into the others.
   */
  isInputBlocked: () => boolean
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  started: false,
  paused: false,
  overlay: 'none',
  dialogue: null,

  startDialogue: (treeId, sourceId) => {
    const tree = getDialogue(treeId)
    if (!tree) {
      // An unknown tree is a content bug; refusing to open is better than
      // opening an empty conversation that blocks the player's input.
      if (import.meta.env.DEV) {
        console.warn(`[Computer Quest] no dialogue tree named "${treeId}"`)
      }
      return
    }
    set({
      dialogue: { treeId, nodeId: tree.root, sourceId },
      overlay: 'none',
      paused: false,
    })
  },

  goToDialogueNode: (nodeId) =>
    set((s) => (s.dialogue ? { dialogue: { ...s.dialogue, nodeId } } : s)),

  endDialogue: () => set({ dialogue: null }),

  openOverlay: (kind) => set({ overlay: kind, dialogue: null }),
  closeOverlay: () => set({ overlay: 'none' }),

  setPaused: (paused) => set({ paused }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),

  beginGame: () => set({ started: true, paused: false, overlay: 'none' }),

  isInputBlocked: () => {
    const s = get()
    return s.paused || s.dialogue !== null || s.overlay !== 'none'
  },
}))
