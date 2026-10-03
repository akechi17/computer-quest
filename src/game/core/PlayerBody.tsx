import { useEffect, useRef } from 'react'
import { BallCollider, CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { PLAYER } from '@/utils/constants'
import { playerTransform } from './playerTransform'

/**
 * The player's physics body.
 *
 * Split out from `PlayerController` because the two have different jobs: this
 * owns the Rapier body and its collider, while the controller is pure per-frame
 * movement logic that reads the body through a ref.
 *
 * `kinematicVelocity` is the right body type here: we set a velocity every
 * frame and let Rapier resolve collisions against the world, but nothing can
 * push the player around. That gives precise, responsive control without the
 * damping hacks a dynamic capsule would need.
 */

export interface PlayerBodyProps {
  /** Where the player starts. `y` is the capsule's centre. */
  spawn: [number, number, number]
  /** Receives the rigid body once it exists so the controller can drive it. */
  onReady: (body: RapierRigidBody) => void
}

export function PlayerBody({ spawn, onReady }: PlayerBodyProps) {
  const body = useRef<RapierRigidBody>(null)

  useEffect(() => {
    if (body.current) onReady(body.current)
  }, [onReady])

  // Prime the shared transform so the camera has a sane target on frame zero.
  useEffect(() => {
    playerTransform.position.set(spawn[0], spawn[1], spawn[2])
  }, [spawn])

  return (
    <RigidBody
      ref={body}
      type="kinematicVelocity"
      position={spawn}
      colliders={false}
      canSleep={false}
      ccd
      // The controller writes rotation directly; Rapier must not add spin.
      lockRotations
    >
      {/* Capsule origin is its centre, so spawn y must be half-height +
          radius for the feet to touch the ground. */}
      <CapsuleCollider
        args={[PLAYER.CAPSULE_HALF_HEIGHT, PLAYER.CAPSULE_RADIUS]}
      />
    </RigidBody>
  )
}

/**
 * A single ball collider at the player's feet.
 *
 * Used as a secondary probe so the ground check is not fooled by standing
 * exactly on the seam between two colliders. Exported for future use by the
 * interaction system's proximity checks.
 */
export function FootProbe() {
  return <BallCollider args={[PLAYER.CAPSULE_RADIUS]} position={[0, -PLAYER.CAPSULE_HALF_HEIGHT, 0]} />
}
