import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { WORLD } from '@/utils/constants'

/**
 * The ground plane and the village's invisible boundary.
 *
 * A single large cuboid is far cheaper than a heightfield and the village is
 * deliberately flat, which also keeps movement readable for younger players.
 *
 * Every collider here is declared explicitly with `CuboidCollider`. The meshes
 * inside a `<RigidBody colliders={false}>` are decorative only — Rapier does
 * not infer a shape from them — so a plain `<mesh>` would leave the player
 * falling through the floor with nothing to stand on.
 */
export function Terrain() {
  const half = WORLD.SIZE / 2

  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      {/* Ground slab. Sitting it slightly below y=0 puts the surface exactly
          at y=0, so spawn coordinates can be read as "on the floor". */}
      <CuboidCollider args={[half, 0.5, half]} position={[0, -0.5, 0]} />
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[WORLD.SIZE, 1, WORLD.SIZE]} />
        <meshStandardMaterial color={WORLD.GROUND_COLOR} roughness={0.95} />
      </mesh>

      {/* Visual detail: a subtle darker disc under the plaza, so the centre of
          the village reads as a place rather than an empty field. */}
      <mesh receiveShadow position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[13, 48]} />
        <meshStandardMaterial color="#4f8f5e" roughness={0.95} />
      </mesh>

      {/* Boundary walls — invisible, but they keep the player inside the slice */}
      <BoundaryWall position={[0, WORLD.BOUNDARY_HEIGHT / 2, -half]} width={WORLD.SIZE} />
      <BoundaryWall position={[0, WORLD.BOUNDARY_HEIGHT / 2, half]} width={WORLD.SIZE} />
      <BoundaryWall
        position={[-half, WORLD.BOUNDARY_HEIGHT / 2, 0]}
        width={WORLD.SIZE}
        rotated
      />
      <BoundaryWall
        position={[half, WORLD.BOUNDARY_HEIGHT / 2, 0]}
        width={WORLD.SIZE}
        rotated
      />
    </RigidBody>
  )
}

function BoundaryWall({
  position,
  width,
  rotated = false,
}: {
  position: [number, number, number]
  width: number
  rotated?: boolean
}) {
  /* Physics only — no mesh at all. An invisible `<mesh>` still costs a draw
     call and a shader compile, and Rapier would not read a shape from it
     anyway, so the collider is declared directly. */
  return (
    <CuboidCollider
      args={[width / 2, WORLD.BOUNDARY_HEIGHT / 2, 0.5]}
      position={position}
      rotation={[0, rotated ? Math.PI / 2 : 0, 0]}
    />
  )
}
