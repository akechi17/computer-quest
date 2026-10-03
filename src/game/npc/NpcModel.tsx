import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { NpcDefinition } from '@/data/types'
import { damp } from '@/utils/math'

/**
 * An NPC, assembled from primitives in the same visual language as the player.
 *
 * NPCs breathe, sway and turn to face the player when close — small motions
 * that do most of the work of making a scene feel alive (spec §20: consistent
 * art direction, clear silhouettes).
 */

interface NpcModelProps {
  definition: NpcDefinition
  /** Set by the NPC's parent each frame; drives the look-at. */
  playerPosition: { x: number; z: number }
  /** Called each frame with the current facing, for interaction checks. */
  onHeadingChange?: (heading: number) => void
}

export function NpcModel({
  definition,
  playerPosition,
  onHeadingChange,
}: NpcModelProps) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)

  const { primary, secondary, accent, skin } = definition.colors

  const materials = useMemo(
    () => ({
      primary: { color: primary, roughness: 0.55, metalness: 0.05 },
      secondary: { color: secondary, roughness: 0.6, metalness: 0.05 },
      skin: { color: skin, roughness: 0.75, metalness: 0 },
    }),
    [primary, secondary, skin],
  )

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)
    const t = state.clock.elapsedTime
    const [px, , pz] = definition.position

    // Face the player when they are nearby, otherwise return to the authored
    // pose. This is what makes an NPC feel like it noticed you.
    const dx = playerPosition.x - px
    const dz = playerPosition.z - pz
    const distance = Math.hypot(dx, dz)
    const attentive = distance < 6

    const targetHeading = attentive
      ? Math.atan2(dx, dz)
      : definition.rotationY

    if (root.current) {
      root.current.rotation.y = damp(root.current.rotation.y, targetHeading, 4, delta)
      onHeadingChange?.(root.current.rotation.y)
    }

    // Idle breathing and a slow sway — cheap, and it stops the NPC reading as
    // a statue.
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.5) * 0.018
      body.current.rotation.z = Math.sin(t * 0.8) * 0.015
    }

    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.55) * 0.18
      head.current.rotation.x = attentive ? Math.sin(t * 1.2) * 0.05 : 0
    }

    // A gentle conversational gesture while the player is in range.
    if (leftArm.current && rightArm.current) {
      const gesture = attentive ? Math.sin(t * 2.1) * 0.18 : Math.sin(t * 0.9) * 0.05
      leftArm.current.rotation.x = gesture
      rightArm.current.rotation.x = -gesture
    }
  })

  return (
    <group
      ref={root}
      position={[definition.position[0], 0, definition.position[2]]}
      rotation={[0, definition.rotationY, 0]}
    >
      <group ref={body}>
        {/* Lab coat / torso */}
        <mesh castShadow position={[0, 0.6, 0]}>
          <capsuleGeometry args={[0.26, 0.38, 6, 14]} />
          <meshStandardMaterial {...materials.primary} />
        </mesh>

        {/* Coat front panel, so the silhouette reads as "scientist" */}
        <mesh position={[0, 0.6, -0.2]}>
          <boxGeometry args={[0.22, 0.42, 0.06]} />
          <meshStandardMaterial color="#e8eefc" roughness={0.7} />
        </mesh>

        <group ref={head} position={[0, 1.0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.24, 20, 16]} />
            <meshStandardMaterial {...materials.skin} />
          </mesh>
          {/* Glasses — two rings joined by a bridge */}
          <mesh position={[-0.09, 0.03, -0.19]}>
            <torusGeometry args={[0.062, 0.014, 8, 16]} />
            <meshStandardMaterial color="#1b2438" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0.09, 0.03, -0.19]}>
            <torusGeometry args={[0.062, 0.014, 8, 16]} />
            <meshStandardMaterial color="#1b2438" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.03, -0.19]}>
            <boxGeometry args={[0.06, 0.014, 0.014]} />
            <meshStandardMaterial color="#1b2438" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* Hair */}
          <mesh position={[0, 0.13, 0.03]}>
            <sphereGeometry args={[0.225, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
            <meshStandardMaterial color="#d8dbe6" roughness={0.85} />
          </mesh>
        </group>

        <group ref={leftArm} position={[-0.32, 0.8, 0]}>
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.08, 0.3, 4, 10]} />
            <meshStandardMaterial color="#e8eefc" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.088, 10, 8]} />
            <meshStandardMaterial {...materials.skin} />
          </mesh>
        </group>

        <group ref={rightArm} position={[0.32, 0.8, 0]}>
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.08, 0.3, 4, 10]} />
            <meshStandardMaterial color="#e8eefc" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.088, 10, 8]} />
            <meshStandardMaterial {...materials.skin} />
          </mesh>
          {/* Clipboard in hand */}
          <mesh position={[0, -0.52, -0.08]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.18, 0.24, 0.02]} />
            <meshStandardMaterial color="#c98a4b" roughness={0.8} />
          </mesh>
        </group>

        {/* Legs */}
        <mesh castShadow position={[-0.12, 0.3, 0]}>
          <capsuleGeometry args={[0.095, 0.28, 4, 10]} />
          <meshStandardMaterial {...materials.secondary} />
        </mesh>
        <mesh castShadow position={[0.12, 0.3, 0]}>
          <capsuleGeometry args={[0.095, 0.28, 4, 10]} />
          <meshStandardMaterial {...materials.secondary} />
        </mesh>

        {/* Shoes */}
        <mesh castShadow position={[-0.12, 0.05, -0.05]}>
          <boxGeometry args={[0.17, 0.1, 0.27]} />
          <meshStandardMaterial color="#2b3549" roughness={0.75} />
        </mesh>
        <mesh castShadow position={[0.12, 0.05, -0.05]}>
          <boxGeometry args={[0.17, 0.1, 0.27]} />
          <meshStandardMaterial color="#2b3549" roughness={0.75} />
        </mesh>
      </group>

      {/* Floating role marker, so the guide is findable from across the plaza */}
      <group position={[0, 1.9, 0]}>
        <mesh>
          <octahedronGeometry args={[0.11, 0]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.1}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}
