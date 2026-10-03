import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

/**
 * The village quest board (spec §7 — Central Plaza contents).
 *
 * Purely decorative in the MVP: it exists so the plaza reads as a hub, and it
 * is the natural home for a quest log UI later. It carries a pinned notice
 * that turns with a subtle sway.
 */
export function QuestBoard() {
  const notice = useRef<Mesh>(null)

  useFrame((state) => {
    if (!notice.current) return
    // A paper flutter; small enough to be noticed only subconsciously.
    notice.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.1) * 0.03
  })

  return (
    <group>
      {/* Posts */}
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} castShadow position={[x, 0.85, 0]}>
          <boxGeometry args={[0.14, 1.7, 0.14]} />
          <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
        </mesh>
      ))}

      {/* Board */}
      <mesh castShadow position={[0, 1.45, 0]}>
        <boxGeometry args={[1.9, 1.3, 0.12]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.85} />
      </mesh>

      {/* Frame */}
      <mesh position={[0, 1.45, -0.07]}>
        <boxGeometry args={[2.05, 1.45, 0.04]} />
        <meshStandardMaterial color="#5a4229" roughness={0.9} />
      </mesh>

      {/* Pinned notices */}
      <mesh ref={notice} position={[-0.4, 1.5, -0.08]}>
        <planeGeometry args={[0.7, 0.85]} />
        <meshStandardMaterial color="#f4efe2" roughness={0.9} />
      </mesh>
      <mesh position={[0.45, 1.35, -0.08]} rotation={[0, 0, 0.08]}>
        <planeGeometry args={[0.6, 0.5]} />
        <meshStandardMaterial color="#f9e9b8" roughness={0.9} />
      </mesh>

      {/* Pins */}
      {(
        [
          [-0.4, 1.9],
          [0.45, 1.58],
        ] as const
      ).map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, y, -0.1]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial
            color="#e879f9"
            emissive="#e879f9"
            emissiveIntensity={0.7}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
