import type { ComponentType, ReactNode } from 'react'
import { RigidBody } from '@react-three/rapier'
import { INTERACTIVES } from '@/data/world'
import { isInteractiveVisible } from '@/game/interaction/visibility'
import { useProgressStore } from '@/stores/progressStore'
import { InteractableVisual } from '@/game/interaction/InteractableVisual'
import {
  CpuChip,
  CpuCooler,
  GpuCard,
  HddDrive,
  KeyboardProp,
  MonitorProp,
  Motherboard,
  PowerSupply,
  RamModule,
  SsdDrive,
} from './HardwareProps'

/**
 * The Hardware Lab's exhibit hall.
 *
 * The room itself (`HardwareLab.tsx`) is just walls; this is what is inside
 * them. The design mirrors the rest of the project: `src/data/world.ts`
 * declares ten `exhibit-*` interactives with their positions and lessons, and
 * this file only knows how to *draw* an exhibit, never which one.
 *
 * The one place that mapping has to be concrete is the model registry below.
 * It is a `Record` rather than a `switch` so that adding an exhibit is one
 * data entry plus one registry line, with no branch to keep in sync — and so
 * that a missing model is a lookup failure this file can report, rather than
 * a silently empty pedestal.
 */

/** The shared prop contract every model in `HardwareProps` already satisfies. */
interface ExhibitModelProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  highlighted?: boolean
}

const EXHIBIT_MODELS: Readonly<Record<string, ComponentType<ExhibitModelProps>>> = {
  'exhibit-cpu': CpuChip,
  'exhibit-ram': RamModule,
  'exhibit-gpu': GpuCard,
  'exhibit-motherboard': Motherboard,
  'exhibit-psu': PowerSupply,
  'exhibit-ssd': SsdDrive,
  'exhibit-hdd': HddDrive,
  'exhibit-cooler': CpuCooler,
  'exhibit-keyboard': KeyboardProp,
  'exhibit-monitor': MonitorProp,
}

/* -------------------------------------------------------------------------- */
/* Pedestal                                                                    */
/* -------------------------------------------------------------------------- */

/** Plinth height. The exhibit sits on top of this. */
const PEDESTAL_HEIGHT = 0.85
const PEDESTAL_TOP_RADIUS = 0.62
const PEDESTAL_BASE_RADIUS = 0.72
/** Half-extent of the collision box around the plinth. */
const PEDESTAL_COLLIDER = [0.68, PEDESTAL_HEIGHT / 2, 0.68] as const

/**
 * A plinth for one component.
 *
 * The models are small and origin-centred — the CPU substrate is a 0.9-unit
 * square, an SSD is a 1.0 x 0.14 x 0.7 brick — so on its own a part reads as
 * debris on the floor. The plinth is what turns it into an *exhibit*: it lifts
 * the part to eye level for a child, gives the label and icon something to
 * sit above, and provides the one solid thing in the room the player cannot
 * walk through.
 *
 * The collision box is deliberately a plain cuboid around the plinth rather
 * than a cylinder: the player only ever bumps into it, and a box costs the
 * physics engine nothing to keep asleep.
 */
function ExhibitPedestal({ children }: { children: ReactNode }) {
  return (
    <group>
      <RigidBody
        type="fixed"
        colliders="cuboid"
        includeInvisible
        position={[0, PEDESTAL_HEIGHT / 2, 0]}
      >
        <mesh visible={false}>
          <boxGeometry args={[PEDESTAL_COLLIDER[0] * 2, PEDESTAL_COLLIDER[1] * 2, PEDESTAL_COLLIDER[2] * 2]} />
        </mesh>
      </RigidBody>

      {/* Plinth */}
      <mesh castShadow receiveShadow position={[0, PEDESTAL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[PEDESTAL_TOP_RADIUS, PEDESTAL_BASE_RADIUS, PEDESTAL_HEIGHT, 10]} />
        <meshStandardMaterial color="#4c5568" roughness={0.8} />
      </mesh>

      {/* Top plate — a lighter disc that reads as a display surface and gives
          the part a cast shadow to stand on. */}
      <mesh receiveShadow position={[0, PEDESTAL_HEIGHT + 0.02, 0]}>
        <cylinderGeometry args={[PEDESTAL_TOP_RADIUS + 0.05, PEDESTAL_TOP_RADIUS + 0.05, 0.06, 10]} />
        <meshStandardMaterial color="#8f9bb3" roughness={0.6} metalness={0.2} />
      </mesh>

      {children}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* The hall                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Renders every exhibit the player has unlocked.
 *
 * An exhibit whose model is missing from the registry is skipped rather than
 * thrown on: a half-built room should still be walkable while content is being
 * authored. The mismatch is reported once in development, where it is a
 * five-second fix, instead of surfacing as a pedestal that teaches nothing.
 */
export function Exhibits() {
  const progress = useProgressStore()

  const rendered = Object.values(INTERACTIVES).filter((definition) => {
    if (!definition.id.startsWith('exhibit-')) return false
    return isInteractiveVisible(definition, progress)
  })

  return (
    <group>
      {rendered.map((definition) => {
        const Model = EXHIBIT_MODELS[definition.id]

        if (!Model) {
          if (import.meta.env.DEV) {
            console.warn(
              `[Computer Quest] exhibit "${definition.id}" has no model in EXHIBIT_MODELS`,
            )
          }
          return null
        }

        /* `lift` raises the part above the plate so a flat model — the CPU
           especially — does not z-fight with the pedestal top. */
        const lift = definition.lift ?? 0.1

        return (
          <InteractableVisual
            key={definition.id}
            definition={definition}
            isObjectiveTarget={false}
          >
            <ExhibitPedestal>
              <Model
                position={[0, PEDESTAL_HEIGHT + lift, 0]}
                rotationY={0}
                scale={definition.scale ?? 1}
                highlighted
              />
            </ExhibitPedestal>
          </InteractableVisual>
        )
      })}
    </group>
  )
}
