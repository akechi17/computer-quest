/**
 * Shared content types.
 *
 * Every quest, lesson, item and NPC in the game is a plain object satisfying
 * one of these interfaces. Nothing in `game/` or `components/` hard-codes
 * educational content — see spec §39.
 */

/* -------------------------------------------------------------------------- */
/* Player progression                                                          */
/* -------------------------------------------------------------------------- */

export interface LevelTier {
  level: number
  title: string
  /** Total accumulated XP required to reach this level. */
  xpRequired: number
}

export interface BadgeDefinition {
  id: string
  name: string
  icon: string
  description: string
}

export type ItemCategory = 'hardware' | 'tool' | 'key' | 'collectible'

export interface ItemDefinition {
  id: string
  name: string
  icon: string
  category: ItemCategory
  description: string
  /** Stacks of more than one are rare; most quest items are unique. */
  stackable: boolean
}

/* -------------------------------------------------------------------------- */
/* Dialogue — spec §15                                                         */
/* -------------------------------------------------------------------------- */

export interface DialogueChoice {
  /** Button label shown to the player. */
  label: string
  /** Node to jump to when chosen. */
  next: string
  /**
   * Optional gate. If present, the choice is hidden unless the quest objective
   * is already complete — used for "I have the RAM" style branches.
   */
  requiresObjective?: string
}

export interface DialogueNode {
  id: string
  speaker: string
  text: string
  /** Emoji portrait stand-in; a real portrait texture can replace this later. */
  portrait?: string
  choices?: DialogueChoice[]
  /** Linear continuation. Ignored when `choices` is present. */
  next?: string
  /** Fires when this node is displayed. */
  onEnter?: DialogueEffect
  /** Marks the conversation as finished; the dialogue UI closes. */
  end?: boolean
}

/** Side effects a dialogue node may trigger. Kept declarative so data stays data. */
export interface DialogueEffect {
  /** Start (or re-focus) a quest by id. */
  startQuest?: string
  /** Advance a quest objective. */
  completeObjective?: string
  /** Award a lesson the first time it is seen. */
  teachLesson?: string
  /** Add an item to the inventory. */
  grantItem?: string
  /** Unlock a zone gate. */
  unlockZone?: string
}

export interface DialogueTree {
  id: string
  /** Node id the conversation starts from. */
  root: string
  nodes: Record<string, DialogueNode>
}

/* -------------------------------------------------------------------------- */
/* Quests — spec §16                                                           */
/* -------------------------------------------------------------------------- */

export type ObjectiveKind =
  | 'talk_to'
  | 'interact'
  | 'collect'
  | 'reach_location'
  | 'solve_puzzle'
  | 'complete_minigame'

export interface QuestObjective {
  id: string
  kind: ObjectiveKind
  /** Player-facing instruction, e.g. "Find the missing RAM module". */
  label: string
  /** Interaction id, NPC id, item id or location id depending on `kind`. */
  target: string
  /** How many are needed. Defaults to 1. */
  count?: number
  /** Optional nudge shown under the objective while it is active. */
  hint?: string
  /**
   * Objectives may be visible from the start but only become actionable later.
   * Used for the tutorial so the player sees the whole shape of the quest.
   */
  hidden?: boolean
}

export interface QuestReward {
  xp?: number
  coins?: number
  badges?: string[]
  items?: string[]
  unlockedZones?: string[]
}

export interface QuestDefinition {
  id: string
  title: string
  /** One-line summary shown in the quest log. */
  description: string
  /** Longer framing text shown when the quest is accepted. */
  intro?: string
  objectives: QuestObjective[]
  rewards: QuestReward
  /** Quests that must be complete before this one can start. */
  requires?: string[]
  /** Quest auto-starts on game start rather than waiting for a giver. */
  autoStart?: boolean
}

/* -------------------------------------------------------------------------- */
/* Lessons — spec §12                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A lesson is the educational payload behind an interactive object. The
 * DISCOVER → INTERACT → EXPLAIN → PRACTICE → REWARD loop from spec §12 maps
 * onto these fields.
 */
export interface Lesson {
  id: string
  /** Concept name, e.g. "RAM". */
  title: string
  /** Emoji used as the object's floating icon. */
  icon: string
  /** One or two short sentences. The spec explicitly forbids long paragraphs. */
  explanation: string
  /** Bullet facts, each under ~12 words, shown alongside the explanation. */
  facts: string[]
  xp: number
  /** Badge this lesson contributes progress toward. */
  badgeId?: string
  /** Mini-game launched from the "Try this!" prompt, if any. */
  minigameId?: string
  /**
   * Optional prompt posed to the player before the practice step, so the
   * interaction ends with an action rather than a "Next" button (spec §11).
   */
  practicePrompt?: string
}

/* -------------------------------------------------------------------------- */
/* World content                                                               */
/* -------------------------------------------------------------------------- */

export type InteractiveKind =
  | 'inspect'
  | 'pickup'
  | 'npc'
  | 'device'
  | 'gate'
  | 'questboard'

export interface InteractiveDefinition {
  id: string
  /** Floating label, e.g. "RAM". */
  label: string
  /** Verb shown in the prompt, e.g. "Inspect". */
  verb: string
  kind: InteractiveKind
  /** World position [x, y, z]. */
  position: [number, number, number]
  /** Y rotation in radians. */
  rotationY?: number
  icon: string
  /** Detection radius; falls back to INTERACTION.DEFAULT_RADIUS. */
  radius?: number
  /** Lesson shown when interacted with. */
  lessonId?: string
  /** Dialogue started when interacted with (NPCs, mostly). */
  dialogueId?: string
  /**
   * Mini-game this object launches when used. This is how the player enters
   * the PRACTICE step from the world (spec §17) — an object that both teaches
   * a lesson and starts a game shows the lesson first, then offers the game.
   */
  startsMinigame?: string
  /** Item added to inventory when picked up. */
  grantsItem?: string
  /** Item consumed from the inventory when used. */
  consumesItem?: string
  /** Objective this interaction completes, if any. */
  completesObjective?: string
  /** Zone unlocked when used. */
  unlocksZone?: string
  /** Hidden until this quest objective is complete. */
  visibleWhenObjective?: string
  /** Hidden unless the named zone is unlocked. */
  requiresZone?: string
  /** Message shown when the player lacks the item this object needs. */
  requiresItemHint?: string
  /**
   * Model scale, for props authored at sizes that do not suit their spot.
   *
   * The models in `HardwareProps` are each built at whatever size reads well
   * in isolation, so a CPU die and a motherboard differ several-fold. These
   * two fields let the world data normalise them for a shared display plinth
   * without touching the models themselves.
   */
  scale?: number
  /** Height above a display plinth, for props that sit flat. */
  lift?: number
}

export interface NpcDefinition {
  id: string
  name: string
  /** Floating role label above the name, e.g. "Guide". */
  role: string
  position: [number, number, number]
  rotationY: number
  /** Body colours for the procedural character mesh. */
  colors: {
    primary: string
    secondary: string
    accent: string
    skin: string
  }
  dialogueId: string
  /** Quest this NPC offers. */
  offersQuest?: string
}

export interface ZoneDefinition {
  id: string
  name: string
  description: string
  /** Where the zone's gate/entrance sits, for the map and unlock checks. */
  anchor: [number, number, number]
  /** Zones start locked unless listed here. */
  unlockedAtStart?: boolean
}

export interface MinigameDefinition {
  id: string
  title: string
  description: string
  /** Lesson this mini-game practises. */
  lessonId: string
  xp: number
}
