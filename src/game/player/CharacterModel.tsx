import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { damp } from '@/utils/math'
import { PLAYER } from '@/utils/constants'

/**
 * The player character, built from primitives and animated in code.
 *
 * Why procedural rather than a GLB: the whole MVP then loads instantly, ships
 * with no licensing questions, and every limb is directly drivable. The
 * animation states below cover exactly the set spec §9 asks for — idle, walk,
 * run, jump, fall, interact, wave, celebrate — without needing a rig.
 *
 * Swapping in a real skinned GLB later means replacing this file only; the
 * controller that drives it passes `state` and `speed` and knows nothing about
 * the mesh.
 */

export type CharacterState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'interact'
  | 'wave'
  | 'celebrate'

export interface CharacterColors {
  primary: string
  secondary: string
  accent: string
  skin: string
}

export const DEFAULT_CHARACTER_COLORS: CharacterColors = {
  primary: '#38bdf8',
  secondary: '#1e3a8a',
  accent: '#fbbf24',
  skin: '#f2c9a0',
}

interface CharacterModelProps {
  state: CharacterState
  /** Normalised 0..1 movement speed, used to drive the limb swing. */
  speed: number
  colors?: CharacterColors
  /** Lowers the mesh so its feet sit on the group origin. */
  yOffset?: number
}

/** How fast each animation state moves its limbs. */
const STATE_TIMING: Record<CharacterState, { swing: number; rate: number }> = {
  idle: { swing: 0.04, rate: 1.6 },
  walk: { swing: 0.55, rate: 7.5 },
  run: { swing: 0.95, rate: 11 },
  jump: { swing: 0.5, rate: 0 },
  fall: { swing: 0.35, rate: 0 },
  interact: { swing: 0.1, rate: 3 },
  wave: { swing: 0.06, rate: 0 },
  celebrate: { swing: 0.2, rate: 0 },
}

export function CharacterModel({
  state,
  speed,
  colors = DEFAULT_CHARACTER_COLORS,
  yOffset = PLAYER.MODEL_Y_OFFSET,
}: CharacterModelProps) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const head = useRef<Group>(null)
  const phase = useRef(0)

  const materials = useMemo(
    () => ({
      primary: { color: colors.primary, roughness: 0.55, metalness: 0.05 },
      secondary: { color: colors.secondary, roughness: 0.6, metalness: 0.05 },
      accent: { color: colors.accent, roughness: 0.35, metalness: 0.25 },
      skin: { color: colors.skin, roughness: 0.75, metalness: 0 },
    }),
    [colors],
  )

  useFrame((_, rawDelta) => {
    // Clamp so a tab-switch stall does not teleport the animation.
    const delta = Math.min(rawDelta, 1 / 20)
    const timing = STATE_TIMING[state]

    // Advance the gait clock, scaled by how fast we are actually moving so the
    // feet do not skate when the player eases between walk and run.
    const speedFactor = state === 'walk' || state === 'run' ? 0.4 + speed * 0.6 : 1
    phase.current += delta * timing.rate * speedFactor

    const wave = Math.sin(phase.current)
    const swing = timing.swing * (state === 'walk' || state === 'run' ? speed : 1)

    if (leftLeg.current && rightLeg.current) {
      leftLeg.current.rotation.x = wave * swing
      rightLeg.current.rotation.x = -wave * swing
    }

    if (leftArm.current && rightArm.current) {
      leftArm.current.rotation.x = -wave * swing * 0.85
      rightArm.current.rotation.x = wave * swing * 0.85
    }

    // State-specific flourishes layered on top of the gait.
    if (state === 'wave' && rightArm.current) {
      const t = performance.now() / 1000
      rightArm.current.rotation.z = -2.3
      rightArm.current.rotation.x = Math.sin(t * 9) * 0.35
    } else if (rightArm.current) {
      rightArm.current.rotation.z = damp(rightArm.current.rotation.z, 0, 10, delta)
    }

    if (state === 'celebrate') {
      const t = performance.now() / 1000
      if (leftArm.current) {
        leftArm.current.rotation.z = 2.5
        leftArm.current.rotation.x = Math.sin(t * 11) * 0.25
      }
      if (rightArm.current) {
        rightArm.current.rotation.z = -2.5
        rightArm.current.rotation.x = Math.sin(t * 11 + 1) * 0.25
      }
    } else if (leftArm.current) {
      leftArm.current.rotation.z = damp(leftArm.current.rotation.z, 0, 10, delta)
    }

    if (state === 'interact' && rightArm.current) {
      rightArm.current.rotation.x = -1.25
      rightArm.current.rotation.z = -0.25
    }

    // Body bob and lean. Kept subtle — the spec wants a responsive feel, not
    // a bouncy cartoon.
    if (body.current) {
      const bobAmount = state === 'run' ? 0.07 : state === 'walk' ? 0.035 : 0.012
      body.current.position.y = Math.abs(wave) * bobAmount
      body.current.rotation.z = wave * swing * 0.06
    }

    if (head.current) {
      head.current.rotation.z = -wave * swing * 0.05
      head.current.rotation.y = state === 'idle' ? Math.sin(phase.current * 0.4) * 0.12 : 0
    }

    // Airborne: tuck the legs and lift the arms.
    if (root.current) {
      if (state === 'jump') {
        root.current.rotation.x = damp(root.current.rotation.x, -0.12, 8, delta)
      } else if (state === 'fall') {
        root.current.rotation.x = damp(root.current.rotation.x, 0.1, 8, delta)
      } else {
        root.current.rotation.x = damp(root.current.rotation.x, 0, 10, delta)
      }
      root.current.position.y = yOffset
    }
  })

  return (
    <group ref={root} position={[0, yOffset, 0]}>
      <group ref={body}>
        {/* Torso */}
        <mesh castShadow position={[0, 0.58, 0]}>
          <capsuleGeometry args={[0.24, 0.34, 6, 14]} />
          <meshStandardMaterial {...materials.primary} />
        </mesh>

        {/* Backpack — reads as a "data pack", gives the silhouette character */}
        <mesh castShadow position={[0, 0.62, 0.24]}>
          <boxGeometry args={[0.3, 0.34, 0.16]} />
          <meshStandardMaterial {...materials.secondary} />
        </mesh>
        <mesh position={[0, 0.62, 0.33]}>
          <boxGeometry args={[0.14, 0.1, 0.02]} />
          <meshStandardMaterial
            color={colors.accent}
            emissive={colors.accent}
            emissiveIntensity={0.8}
            roughness={0.3}
          />
        </mesh>

        {/* Head */}
        <group ref={head} position={[0, 0.98, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.23, 20, 16]} />
            <meshStandardMaterial {...materials.skin} />
          </mesh>
          {/* Visor */}
          <mesh position={[0, 0.02, -0.17]}>
            <boxGeometry args={[0.3, 0.11, 0.07]} />
            <meshStandardMaterial
              color="#0f172a"
              emissive={colors.accent}
              emissiveIntensity={0.35}
              roughness={0.15}
              metalness={0.4}
            />
          </mesh>
          {/* Antenna — a small nod to the computer theme */}
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
            <meshStandardMaterial {...materials.secondary} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Arms — pivot at the shoulder so rotation.x is a natural swing */}
        <group ref={leftArm} position={[-0.3, 0.78, 0]}>
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.075, 0.3, 4, 10]} />
            <meshStandardMaterial {...materials.primary} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial {...materials.skin} />
          </mesh>
        </group>

        <group ref={rightArm} position={[0.3, 0.78, 0]}>
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.075, 0.3, 4, 10]} />
            <meshStandardMaterial {...materials.primary} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial {...materials.skin} />
          </mesh>
        </group>

        {/* Legs */}
        <group ref={leftLeg} position={[-0.115, 0.3, 0]}>
          <mesh castShadow position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.09, 0.26, 4, 10]} />
            <meshStandardMaterial {...materials.secondary} />
          </mesh>
          <mesh castShadow position={[0, -0.33, -0.05]}>
            <boxGeometry args={[0.16, 0.09, 0.26]} />
            <meshStandardMaterial color="#1b2438" roughness={0.7} />
          </mesh>
        </group>

        <group ref={rightLeg} position={[0.115, 0.3, 0]}>
          <mesh castShadow position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.09, 0.26, 4, 10]} />
            <meshStandardMaterial {...materials.secondary} />
          </mesh>
          <mesh castShadow position={[0, -0.33, -0.05]}>
            <boxGeometry args={[0.16, 0.09, 0.26]} />
            <meshStandardMaterial color="#1b2438" roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Re-exported so callers can type a mesh ref without importing three. */
export type CharacterMeshRef = Mesh
