import type { InteractiveDefinition, NpcDefinition } from './types'
import { getLesson } from './lessons'
import { getZone } from './zones'
import { INTERACTION } from '@/utils/constants'
import { interactionId } from '@/utils/id'

/**
 * Computer Village layout.
 *
 * Positions are authored here rather than inside scene components so the world
 * can be rearranged without touching rendering code, and so quest objectives
 * can reference objects by id. See spec §39.
 *
 * Layout sketch (X to the right, -Z away from spawn):
 *
 *            [-Z] Hardware Lab gate + Memory Garden
 *                          |
 *   Digital Forest -- [Plaza + Monument] -- Network Tower
 *                          |
 *            [Storage Warehouse]  [+Z, toward the player]
 */

/* -------------------------------------------------------------------------- */
/* NPCs                                                                        */
/* -------------------------------------------------------------------------- */

export const NPCS: Readonly<Record<string, NpcDefinition>> = {
  'professor-byte': {
    id: 'professor-byte',
    name: 'Professor Byte',
    role: 'Guide',
    position: [3.4, 0, -1.6],
    rotationY: -0.5,
    colors: {
      primary: '#3f7fd6',
      secondary: '#274b80',
      accent: '#fbbf24',
      skin: '#f2c9a0',
    },
    dialogueId: 'professor-byte-intro',
    offersQuest: 'computer-has-gone-quiet',
  },
}

export const NPC_LIST: readonly NpcDefinition[] = Object.values(NPCS)

/* -------------------------------------------------------------------------- */
/* Interactives                                                                */
/* -------------------------------------------------------------------------- */

/* -- Hardware Lab exhibits -------------------------------------------------- */
/*
 * The workshop the lab pass opens. Each pedestal shows one real component and
 * teaches the lesson behind it, so the room is the *reward* for the first
 * quest rather than a second one: nothing here carries an objective, and
 * nothing here is required to finish anything.
 *
 * `requiresZone: 'hardware-lab'` is the whole gate — `isInteractiveVisible`
 * already hides every interactive whose zone is locked, which is why the
 * exhibits need no new mechanism and no `hidden` flag.
 *
 * Between them these ten reach `software`, `processing` and `storage`: the
 * three lessons that had no object anywhere in the world, and whose badges
 * (`hardware-apprentice`, `cpu-specialist`, `memory-master`) could not be
 * earned at all until now.
 *
 * Positions are a 5 x 2 grid inside the room — the lab spans x[-7, 7] and
 * z[-36.5, -27.5], so rows sit at z = -30.5 and -34, columns every 2.6 from
 * x = -5.2. Everything faces +Z, back toward the doorway the player walks in.
 */

/** Row nearest the doorway. */
const EXHIBIT_FRONT_ROW_Z = -30.5
/** Row further in, toward the back wall. */
const EXHIBIT_BACK_ROW_Z = -34
/** Column x positions, centred on the doorway. */
const EXHIBIT_COLUMNS = [-5.2, -2.6, 0, 2.6, 5.2] as const
/** Every exhibit faces the way the player enters. */
const EXHIBIT_FACING = 0

/**
 * Builds one exhibit definition.
 *
 * The grid is computed rather than typed out ten times so that moving a row or
 * a column is one edit, and so the numbers that *are* hand-authored — `scale`
 * and `lift` — stand out as the deliberate ones.
 *
 * Those two live in the data because the models in `HardwareProps` are
 * authored at wildly different sizes: a CPU die is a flat 0.9-unit square
 * while a motherboard is several times that. Normalising them for a shared
 * pedestal is a presentation decision about this room, not a property of the
 * model, so it belongs beside the position rather than in the renderer.
 */
function exhibit(
  id: string,
  label: string,
  icon: string,
  lessonId: string,
  cell: readonly [row: 0 | 1, column: number],
  options: { scale?: number; lift?: number } = {},
): InteractiveDefinition {
  const [row, column] = cell
  const x = EXHIBIT_COLUMNS[column]
  if (x === undefined) throw new Error(`exhibit "${id}": no column ${column}`)
  return {
    id,
    label,
    verb: 'Inspect',
    kind: 'inspect',
    position: [x, 0, row === 0 ? EXHIBIT_FRONT_ROW_Z : EXHIBIT_BACK_ROW_Z],
    rotationY: EXHIBIT_FACING,
    icon,
    radius: INTERACTION.DEFAULT_RADIUS,
    lessonId,
    requiresZone: 'hardware-lab',
    ...options,
  }
}

const EXHIBITS: Readonly<Record<string, InteractiveDefinition>> = {
  // Front row — what a computer is made of, in the order you would meet it.
  'exhibit-cpu': exhibit('exhibit-cpu', 'Processor (CPU)', '🧠', 'processing', [0, 0], {
    lift: 0.18,
  }),
  'exhibit-ram': exhibit('exhibit-ram', 'Memory (RAM)', '💾', 'ram', [0, 1], {
    lift: 0.3,
    scale: 0.9,
  }),
  'exhibit-gpu': exhibit('exhibit-gpu', 'Graphics Card', '🎮', 'output', [0, 2], {
    lift: 0.22,
    scale: 0.85,
  }),
  'exhibit-motherboard': exhibit(
    'exhibit-motherboard',
    'Motherboard',
    '🧩',
    'hardware',
    [0, 3],
    { lift: 0.12, scale: 0.62 },
  ),
  'exhibit-psu': exhibit('exhibit-psu', 'Power Supply', '🔌', 'hardware', [0, 4], {
    lift: 0.26,
  }),

  // Back row — where things are kept, and what keeps them running.
  'exhibit-ssd': exhibit('exhibit-ssd', 'Solid-State Drive', '⚡', 'storage', [1, 0], {
    lift: 0.16,
  }),
  'exhibit-hdd': exhibit('exhibit-hdd', 'Hard Disk Drive', '💽', 'storage', [1, 1], {
    lift: 0.2,
  }),
  'exhibit-cooler': exhibit('exhibit-cooler', 'CPU Cooler', '❄️', 'hardware', [1, 2], {
    lift: 0.3,
  }),
  'exhibit-keyboard': exhibit(
    'exhibit-keyboard',
    'Keyboard',
    '⌨️',
    'input',
    [1, 3],
    { lift: 0.1, scale: 0.8 },
  ),
  'exhibit-monitor': exhibit('exhibit-monitor', 'Monitor', '🖥️', 'output', [1, 4], {
    lift: 0.3,
    scale: 0.75,
  }),
}

/**
 * The quest's "village computer" is assembled from several separately
 * inspectable parts — monitor, keyboard, tower — which is what makes the
 * investigation step feel like detective work instead of one button press.
 */
export const INTERACTIVES: Readonly<Record<string, InteractiveDefinition>> = {
  'monument': {
    id: 'monument',
    label: 'Computer Monument',
    verb: 'Inspect',
    kind: 'inspect',
    position: [0, 0, -12],
    icon: '🗿',
    radius: 4.5,
    lessonId: 'computer',
  },

  'village-computer-monitor': {
    id: 'village-computer-monitor',
    label: 'Monitor',
    verb: 'Inspect',
    kind: 'device',
    position: [-2.1, 0, -7.5],
    rotationY: 0.35,
    icon: '🖥️',
    lessonId: 'output',
  },

  'village-computer-keyboard': {
    id: 'village-computer-keyboard',
    label: 'Keyboard',
    verb: 'Inspect',
    kind: 'device',
    position: [-1.3, 0, -6.2],
    rotationY: 0.35,
    icon: '⌨️',
    lessonId: 'input',
  },

  'village-computer-mouse': {
    id: 'village-computer-mouse',
    label: 'Mouse',
    verb: 'Inspect',
    kind: 'device',
    position: [-0.15, 0, -6.1],
    rotationY: 0.35,
    icon: '🖱️',
    radius: 2.0,
    lessonId: 'input',
  },

  'village-computer-tower': {
    id: 'village-computer-tower',
    label: 'Computer Tower',
    verb: 'Inspect',
    kind: 'device',
    position: [0.6, 0, -7.9],
    rotationY: 0.2,
    icon: '🧰',
    lessonId: 'hardware',
    /*
     * The tower is where the RAM goes. Once the player is carrying the module
     * it becomes the installation point: the `ram-sorting` practice game is
     * what "fitting it in" actually means. Before that it is just a lesson.
     */
    startsMinigame: 'ram-sorting',
    consumesItem: 'ram-module',
    completesObjective: 'install-ram',
    requiresItemHint:
      'An empty memory slot. Something is missing from it.',
  },

  'missing-ram': {
    id: 'missing-ram',
    label: 'RAM Module',
    verb: 'Pick up',
    kind: 'pickup',
    position: [9.5, 0, 5.5],
    icon: '💾',
    radius: 2.2,
    lessonId: 'ram',
    grantsItem: 'ram-module',
  },

  'quest-board': {
    id: 'quest-board',
    label: 'Quest Board',
    verb: 'Read',
    kind: 'questboard',
    position: [-5.5, 0, -2.5],
    rotationY: 0.9,
    icon: '📋',
    radius: 2.8,
    lessonId: 'computer',
  },

  /* -- Hardware Lab teasers: visible, but gated behind the lab pass -------- */
  'memory-garden-crystal': {
    id: 'memory-garden-crystal',
    label: 'Data Crystal',
    verb: 'Collect',
    kind: 'pickup',
    position: [14, 0, -14],
    icon: '💎',
    radius: 2.2,
    grantsItem: 'data-crystal',
    hidden: true,
  } as InteractiveDefinition,

  'lab-gate': {
    id: 'lab-gate',
    label: 'Hardware Lab',
    verb: 'Enter',
    kind: 'gate',
    position: [0, 0, -24],
    icon: '🔒',
    radius: 3.2,
    unlocksZone: 'hardware-lab',
  },

  ...EXHIBITS,
}

export const INTERACTIVE_LIST: readonly InteractiveDefinition[] = Object.values(
  INTERACTIVES,
)

export function getInteractive(id: string): InteractiveDefinition | undefined {
  return INTERACTIVES[id]
}

/* -------------------------------------------------------------------------- */
/* Objective target resolution                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Interaction ids are namespaced (`zone:object`) so that two zones can each
 * have a "monitor". Quest data refers to them by that full id.
 */
export const VILLAGE = 'village'

export function villageObj(objectKey: keyof typeof INTERACTIVES): string {
  return interactionId(VILLAGE, objectKey)
}

/** Default detection radius when an interactive does not override it. */
export function radiusFor(def: InteractiveDefinition): number {
  return def.radius ?? INTERACTION.DEFAULT_RADIUS
}

/**
 * Named spots used by `reach_location` objectives and the tutorial. Kept
 * separate from interactives because a location can be reached, not touched.
 */
export const LOCATIONS: Readonly<
  Record<string, { id: string; label: string; position: [number, number, number] }>
> = {
  'plaza-center': {
    id: 'plaza-center',
    label: 'Central Plaza',
    position: [0, 0, 0],
  },
  'memory-garden': {
    id: 'memory-garden',
    label: 'Memory Garden',
    position: [14, 0, -14],
  },
  'storage-warehouse': {
    id: 'storage-warehouse',
    label: 'Storage Warehouse',
    position: [0, 0, 16],
  },
  'network-tower': {
    id: 'network-tower',
    label: 'Network Tower',
    position: [18, 0, 2],
  },
  'digital-forest': {
    id: 'digital-forest',
    label: 'Digital Forest',
    position: [-18, 0, 4],
  },
}

/* -------------------------------------------------------------------------- */
/* Content integrity                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Checks the exhibit definitions at startup, in development only.
 *
 * An exhibit is a label, a model and a lesson; three separate objects that
 * have to agree. If the lesson id is misspelled, or the model has no registry
 * entry, the failure mode is silent and looks deliberate — a pedestal that
 * shows a part and teaches nothing, which is exactly the "quiz with no
 * question" the spec warns against. The renderer refuses to guess, so this
 * reports the mistake where it can still be fixed.
 *
 * Runs in DEV rather than as a unit test because the data is a module-level
 * constant: importing it here proves the same thing, at the same moment the
 * game would first read it.
 */
if (import.meta.env.DEV) {
  const problems: string[] = []

  for (const definition of Object.values(INTERACTIVES)) {
    if (!definition.id.startsWith('exhibit-')) continue

    if (!definition.lessonId) {
      problems.push(`"${definition.id}" teaches no lesson`)
    } else if (!getLesson(definition.lessonId)) {
      problems.push(
        `"${definition.id}" points at lesson "${definition.lessonId}", which does not exist`,
      )
    }

    if (!definition.requiresZone) {
      problems.push(`"${definition.id}" is not gated to a zone, so it is reachable from the start`)
    } else if (!getZone(definition.requiresZone)) {
      problems.push(
        `"${definition.id}" requires zone "${definition.requiresZone}", which does not exist`,
      )
    }
  }

  /*
   * The Software lesson is the one concept with no honest physical exhibit —
   * you cannot put "instructions" on a pedestal. It is reached from the CPU
   * instead, so this asserts it is still taught by *something* rather than
   * quietly dropped when the CPU's lesson was chosen.
   */
  const taught = new Set(
    Object.values(INTERACTIVES)
      .map((definition) => definition.lessonId)
      .filter((id): id is string => Boolean(id)),
  )
  for (const lessonId of ['software', 'processing', 'storage']) {
    if (!taught.has(lessonId)) {
      problems.push(`lesson "${lessonId}" is not taught by any interactive`)
    }
  }

  for (const problem of problems) {
    console.warn(`[Computer Quest] content: ${problem}`)
  }
}
