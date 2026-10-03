import { RigidBody } from '@react-three/rapier'

/**
 * The Hardware Lab — a walk-in room of component exhibits.
 *
 * The building started life as a solid box in `Scenery`'s `BUILDINGS` list,
 * which was fine while the lab was only a destination on the horizon. Now that
 * quest #1 hands the player a `lab-pass` and promises a workshop, the reward
 * has to be somewhere they can actually stand, so the shell is built here as
 * four walls with a doorway rather than one opaque block.
 *
 * The footprint is unchanged from the original building — `[0, 0, -32]` sized
 * `[14, 6, 9]` — so the plaza layout, the gate and the zone anchor written in
 * `zones.ts` all still line up.
 *
 * Dimensions are derived from `LAB` below rather than typed twice, because the
 * doorway is the one piece of geometry where the visual and the collider
 * disagreeing is invisible on screen and fatal in play: a gap you can see but
 * not walk through, or a wall segment you can see through but not past.
 */

/** Authoring constants for the shell. Everything else is measured from these. */
export const LAB = {
  /** Centre of the building footprint. */
  center: [0, 0, -32] as const,
  /** Outer footprint, matching the original `BUILDINGS` entry. */
  size: [14, 6, 9] as const,
  /** Wall thickness. */
  wall: 0.3,
  /** Width of the doorway cut through the front wall. */
  doorWidth: 4,
} as const

const [CENTER_X, , CENTER_Z] = LAB.center
const [WIDTH, HEIGHT, DEPTH] = LAB.size

const HALF_W = WIDTH / 2
const HALF_D = DEPTH / 2
/** Distance from the centre line to a wall's own centre. */
const SIDE_X = HALF_W - LAB.wall / 2
/** Front (south, toward the village) and back (north) wall centre lines. */
const FRONT_Z = CENTER_Z + HALF_D - LAB.wall / 2
const BACK_Z = CENTER_Z - HALF_D + LAB.wall / 2

/** A front-wall segment spans from the outer edge to the doorway. */
const DOOR_HALF = LAB.doorWidth / 2
const FRONT_SEGMENT_WIDTH = HALF_W - DOOR_HALF
/** Centre of that segment, measured from the building centre. */
const FRONT_SEGMENT_X = DOOR_HALF + FRONT_SEGMENT_WIDTH / 2

/** Interior spans this much of the depth, used to place the interior lights. */
const INTERIOR_DEPTH = DEPTH - LAB.wall * 2

const COLORS = {
  floor: '#6b6f7d',
  wall: '#3a4a6b',
  ceiling: '#2c3a56',
  roof: '#26334d',
  trim: '#7dd3fc',
} as const

/* -------------------------------------------------------------------------- */
/* Colliders                                                                   */
/* -------------------------------------------------------------------------- */

interface Box {
  position: [number, number, number]
  size: [number, number, number]
}

/**
 * The shell's collision boxes, measured from the same constants that draw it.
 *
 * The floor is deliberately a slab whose *top* sits at y = 0, level with the
 * plateau: any gap between the village ground and the lab floor is a hole the
 * player falls through at the exact moment they walk in.
 */
const SHELL_COLLIDERS: Box[] = [
  {
    position: [CENTER_X, -LAB.wall / 2, CENTER_Z],
    size: [WIDTH, LAB.wall, DEPTH],
  },
  // Back wall
  { position: [CENTER_X, HEIGHT / 2, BACK_Z], size: [WIDTH, HEIGHT, LAB.wall] },
  // Side walls
  { position: [-SIDE_X, HEIGHT / 2, CENTER_Z], size: [LAB.wall, HEIGHT, DEPTH] },
  { position: [SIDE_X, HEIGHT / 2, CENTER_Z], size: [LAB.wall, HEIGHT, DEPTH] },
  // Front wall, split either side of the doorway
  {
    position: [-FRONT_SEGMENT_X, HEIGHT / 2, FRONT_Z],
    size: [FRONT_SEGMENT_WIDTH, HEIGHT, LAB.wall],
  },
  {
    position: [FRONT_SEGMENT_X, HEIGHT / 2, FRONT_Z],
    size: [FRONT_SEGMENT_WIDTH, HEIGHT, LAB.wall],
  },
  // Ceiling
  { position: [CENTER_X, HEIGHT + LAB.wall / 2, CENTER_Z], size: [WIDTH, LAB.wall, DEPTH] },
]

function ShellColliders() {
  return (
    <>
      {SHELL_COLLIDERS.map((box, index) => (
        /* `includeInvisible` is required, not decorative.
           `@react-three/rapier` builds a body's colliders by traversing its
           *visible* children, so an invisible box mesh produces no shape at
           all — silently, with nothing on screen to suggest the wall is
           missing. Every static collider in this project is drawn that way, so
           without this flag the walls simply do not exist. */
        <RigidBody
          key={index}
          type="fixed"
          colliders="cuboid"
          includeInvisible
          position={box.position}
        >
          <mesh visible={false}>
            <boxGeometry args={box.size} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* The lab                                                                     */
/* -------------------------------------------------------------------------- */

export function HardwareLab() {
  return (
    <group>
      {/* ---------------------------------------------------------------- */}
      {/* Interior lighting                                                 */}
      {/* ---------------------------------------------------------------- */}
      {/* The room has a ceiling, so the sun at [26, 38, 18] never reaches the
          floor. Two overhead lamps plus a little ambient keep the exhibits
          legible without pretending to be daylight. No shadow casting: the
          single sun is what `RENDER.SHADOW_MAP_SIZE` is tuned for, and a
          second caster buys nothing a child would notice. */}
      <ambientLight intensity={0.45} color="#cfe0ff" />
      <pointLight
        position={[CENTER_X, HEIGHT - 0.8, CENTER_Z + INTERIOR_DEPTH / 4]}
        color="#dbe9ff"
        intensity={22}
        distance={11}
        decay={2}
      />
      <pointLight
        position={[CENTER_X, HEIGHT - 0.8, CENTER_Z - INTERIOR_DEPTH / 4]}
        color="#dbe9ff"
        intensity={22}
        distance={11}
        decay={2}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Shell                                                             */}
      {/* ---------------------------------------------------------------- */}
      <group position={[CENTER_X, 0, CENTER_Z]}>
        {/* Floor — top face flush with the ground outside. */}
        <mesh receiveShadow position={[0, -LAB.wall / 2, 0]}>
          <boxGeometry args={[WIDTH, LAB.wall, DEPTH]} />
          <meshStandardMaterial color={COLORS.floor} roughness={0.9} />
        </mesh>

        {/* Back wall */}
        <mesh castShadow receiveShadow position={[0, HEIGHT / 2, BACK_Z - CENTER_Z]}>
          <boxGeometry args={[WIDTH, HEIGHT, LAB.wall]} />
          <meshStandardMaterial color={COLORS.wall} roughness={0.75} />
        </mesh>

        {/* Side walls */}
        {[-SIDE_X, SIDE_X].map((x) => (
          <mesh key={x} castShadow receiveShadow position={[x, HEIGHT / 2, 0]}>
            <boxGeometry args={[LAB.wall, HEIGHT, DEPTH]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.75} />
          </mesh>
        ))}

        {/* Front wall and the doorway through it. The lintel above the gap is
            what makes this read as a door rather than a missing wall. */}
        {[-FRONT_SEGMENT_X, FRONT_SEGMENT_X].map((x) => (
          <mesh
            key={x}
            castShadow
            receiveShadow
            position={[x, HEIGHT / 2, FRONT_Z - CENTER_Z]}
          >
            <boxGeometry args={[FRONT_SEGMENT_WIDTH, HEIGHT, LAB.wall]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.75} />
          </mesh>
        ))}

        {/* Lintel */}
        <mesh
          castShadow
          receiveShadow
          position={[0, HEIGHT - 0.6, FRONT_Z - CENTER_Z]}
        >
          <boxGeometry args={[LAB.doorWidth, 1.2, LAB.wall]} />
          <meshStandardMaterial color={COLORS.wall} roughness={0.75} />
        </mesh>

        {/* A pale frame around the opening, so the way in is obvious from the
            plaza without a sign pointing at it. */}
        {[-DOOR_HALF, DOOR_HALF].map((x) => (
          <mesh key={x} position={[x, HEIGHT / 2 - 0.6, FRONT_Z - CENTER_Z]}>
            <boxGeometry args={[0.16, HEIGHT - 1.2, LAB.wall + 0.06]} />
            <meshStandardMaterial
              color={COLORS.trim}
              emissive={COLORS.trim}
              emissiveIntensity={0.35}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Ceiling */}
        <mesh receiveShadow position={[0, HEIGHT + LAB.wall / 2, 0]}>
          <boxGeometry args={[WIDTH, LAB.wall, DEPTH]} />
          <meshStandardMaterial color={COLORS.ceiling} roughness={0.85} />
        </mesh>

        {/* Roof cap — the same slightly-wider flat cap the other buildings use,
            so the lab still reads as part of the village skyline. */}
        <mesh castShadow position={[0, HEIGHT + 0.6, 0]}>
          <boxGeometry args={[WIDTH + 0.7, 0.4, DEPTH + 0.7]} />
          <meshStandardMaterial color={COLORS.roof} roughness={0.8} />
        </mesh>
      </group>

      <ShellColliders />
    </group>
  )
}
