import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
import { Group, Vector3 } from 'three'
import { CharacterModel, type CharacterState } from './CharacterModel'
import { PLAYER, PHYSICS } from '@/utils/constants'
import { damp, dampAngle } from '@/utils/math'
import { inputState } from '@/game/core/inputState'
import { playerTransform } from '@/game/core/playerTransform'
import { PlayerBody } from '@/game/core/PlayerBody'
import { usePlayerBodyStore } from '@/game/core/GameCanvas'
import { cameraRig } from '@/game/camera/ThirdPersonCamera'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Drives the player character.
 *
 * Split into two components on purpose:
 *
 *   PlayerController — owns the physics body ref and all per-frame movement
 *                      logic. It never re-renders; it is a pure `useFrame` host.
 *   CharacterVisual  — the only part that re-renders, and only when the
 *                      animation state or speed band actually changes.
 *
 * That split is what lets the character animate at 60fps without React doing
 * any work (spec §29: "unnecessary React re-renders").
 */

/** Spawn point: the plaza, facing the monument. */
export const PLAYER_SPAWN: [number, number, number] = [
  0,
  PLAYER.CAPSULE_HALF_HEIGHT + PLAYER.CAPSULE_RADIUS + 0.05,
  4,
]

/** Scratch vectors — allocating inside useFrame causes GC hitches. */
const scratch = {
  axis: { x: 0, y: 0 },
  forward: new Vector3(),
  right: new Vector3(),
  movement: new Vector3(),
  rayOrigin: { x: 0, y: 0, z: 0 },
}

/**
 * How far short of a wall the player stops, in units.
 *
 * Shape casting measures the whole capsule, so a small positive skin keeps the
 * character visually clear of the surface without opening a gap wide enough to
 * see through or slip into.
 */
const WALL_SKIN = 0.05

/**
 * How far above the ground the wall sweep is anchored, in units.
 *
 * The sweep uses the capsule's own centre height, and the *shape* it sweeps is
 * a ball rather than the capsule. Both halves of that matter:
 *
 *  - A capsule swept at centre height grazes the floor slab the player stands
 *    on. Rapier counts a touching contact as a hit at `time_of_impact` zero,
 *    which is indistinguishable from a wall directly underfoot — so every frame
 *    looked like a wall and the player could not move at all. Lifting the sweep
 *    "half a capsule" clears the centre but not the capsule's *bottom*, which
 *    still rests on the slab; the sweep has to be a shape that cannot reach the
 *    floor.
 *
 *  - A ball of the capsule's radius, centred at the capsule's centre, occupies
 *    exactly the space the character occupies at that height and touches
 *    nothing below its own radius. `PLAYER.CAPSULE_HALF_HEIGHT` is comfortably
 *    larger than the radius, so the ball never reaches the ground.
 *
 * The sweep therefore measures walls, not floors, which is the only thing it is
 * for. Grounding is a separate ray cast (`castRay` below).
 */
const WALL_PROBE_RADIUS = PLAYER.CAPSULE_RADIUS

/**
 * Minimum time the character stays airborne after jumping, in seconds.
 *
 * The full arc lasts `2 * JUMP_VELOCITY / |GRAVITY|` ≈ 0.56 s. This is a
 * fraction of that — enough to decide "airborne" on wall-clock time rather than
 * on a velocity that a single long frame can reverse, but short enough that a
 * jump onto a low ledge still lands on time and a jump off one still registers.
 */
const JUMP_LOCKOUT = 0.18

/**
 * Where the ground ray starts, relative to the capsule's centre, in units.
 *
 * Above the capsule rather than at its centre: a ray cast from inside the
 * character's own standing space starts inside the floor whenever the body has
 * sunk, and Rapier reports an origin-inside-collider cast as a hit at zero
 * distance — which says nothing about where the surface actually is. Starting
 * clear of the character makes the hit distance a real height.
 *
 * Must exceed `CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS` (0.95) so that a standing
 * character is always below the origin, with room for a jump still to be above
 * the floor when the ray is cast.
 */
const GROUND_RAY_ORIGIN_LIFT = 1.2

/**
 * How far the ground ray reaches, in units.
 *
 * Generous on purpose. The ray is the only thing that puts the character back
 * on the floor, so it has to survive a frame that is long enough to carry the
 * body a long way — a cast sized to the standing distance is outrun by a single
 * dropped frame, and the character then falls forever with nothing beneath them
 * to find. A long reach costs one ray per frame and removes that failure mode
 * entirely.
 *
 * Reaching far is safe because overhead geometry is rejected by the
 * `isFloor` test below rather than by the ray's length.
 */
const GROUND_RAY_LENGTH = 40

/**
 * How far above the feet a surface may sit and still count as ground, in units.
 *
 * Slack for the floor the character is standing on: the ray is cast between
 * frames, so by the time it is read the body has already moved a little. A
 * surface more than this above the feet is overhead, not floor.
 */
const GROUND_SNAP_TOLERANCE = 0.4



export function PlayerController() {
  const bodyRef = useRef<RapierRigidBody | null>(null)
  const heading = useRef(0)
  const verticalVelocity = useRef(0)
  const grounded = useRef(true)
  /**
   * Seconds left of a forced airborne state after a jump.
   *
   * Velocity alone cannot say "airborne" reliably: on a long frame — a stall, a
   * tab regaining focus, a hitch in a headless renderer — gravity is applied in
   * one step large enough to reverse the upward velocity, the ground ray still
   * finds the floor beneath the barely-risen body, and the character is grounded
   * again the very next frame. With the jump key held, that re-arms the jump and
   * stacks velocity until the player leaves the world.
   *
   * A short timer is frame-rate independent: after a jump the character is
   * airborne for a fixed wall-clock minimum no matter how the frames fall.
   */
  const jumpLockout = useRef(0)
  const currentState = useRef<CharacterState>('idle')
  const oneShotUntil = useRef(0)

  const [renderState, setRenderState] = useState<CharacterState>('idle')
  const [speed, setSpeed] = useState(0)

  const { world, rapier } = useRapier()
  const isInputBlocked = useSessionStore((s) => s.isInputBlocked)
  const dialogueActive = useSessionStore((s) => s.dialogue !== null)

  /* ---------------------------------------------------------------- */
  /* One-shot animation bridge                                          */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    characterAnimator.play = (state, durationMs) => {
      currentState.current = state
      oneShotUntil.current = performance.now() + durationMs
      setRenderState(state)
    }
    return () => {
      characterAnimator.play = () => {}
    }
  }, [])

  const handleReady = useCallback((body: RapierRigidBody) => {
    bodyRef.current = body
    // Published so the test probe can move the player without a ref to hand.
    usePlayerBodyStore.getState().setBody(body)
  }, [])

  /* Aiming hook for the test probe. The heading lives in a ref here and is
     re-derived from movement every frame, so an outside caller needs this
     accessor rather than the shared transform. */
  useEffect(() => {
    usePlayerBodyStore.getState().setFaceHeading((next) => {
      heading.current = next
      playerTransform.heading = next
    })
    return () => usePlayerBodyStore.getState().setFaceHeading(null)
  }, [])

  /* ---------------------------------------------------------------- */
  /* Per-frame movement                                                 */
  /* ---------------------------------------------------------------- */
  useFrame((_, rawDelta) => {
    const rb = bodyRef.current
    if (!rb) return

    const delta = Math.min(rawDelta, 1 / 20)

    /* ---------------------------------------------------------------- */
    /* Ground probe                                                       */
    /* ---------------------------------------------------------------- */
    /*
     * A ray straight down, from a fixed height above the capsule rather than
     * from its centre.
     *
     * Casting from the centre cannot work when the character is sunk into the
     * floor — which is the normal state, because nothing holds a
     * `kinematicVelocity` body up. A ray that starts *inside* a collider reports
     * `timeOfImpact` zero, so the probe reads "ground is zero metres away" no
     * matter how deep the capsule is buried, and the reading carries no
     * information about where the surface actually is.
     *
     * Anchoring the cast a fixed `GROUND_RAY_ORIGIN_LIFT` above the capsule
     * keeps the origin outside the floor for every plausible standing height and
     * lets the hit distance be converted into a real height:
     *
     *     surfaceY = originY - toi
     *
     * Casting from above the head brings its own hazard: the ray passes through
     * a ceiling on the way down, and would happily report the *roof* as the
     * floor. A surface is therefore only accepted when it lies at or below the
     * capsule's feet, which is what `GROUND_RAY_LENGTH` bounds — the ray ends at
     * the feet rather than continuing past them.
     */
    const translation = rb.translation()
    const rayOriginY = translation.y + GROUND_RAY_ORIGIN_LIFT

    scratch.rayOrigin.x = translation.x
    scratch.rayOrigin.y = rayOriginY
    scratch.rayOrigin.z = translation.z

    const ray = new rapier.Ray(scratch.rayOrigin, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(
      ray,
      GROUND_RAY_LENGTH,
      true,
      undefined,
      undefined,
      // The player is a kinematic body; excluding its rigid body keeps the
      // probe from reporting the player's own capsule as ground. Rapier takes
      // the excluded collider first, so that slot stays undefined.
      undefined,
      rb,
    )

    /* The surface's world height, or null when there is nothing below. */
    const surfaceY = hit ? rayOriginY - hit.timeOfImpact : null

    /* Reject anything that is not below the feet.
     *
     * The ray is cast from above the head, so on its way down it passes through
     * whatever is overhead — the lab's ceiling collider sits at y 6.0–6.3, and
     * the ray finds its top face before it ever reaches the floor. Standing the
     * character on the nearest ceiling is exactly what that produced: a player
     * who teleports into the lab is lifted onto the roof and stays there.
     *
     * The test is against the capsule's *feet*, not the ray origin: a surface
     * counts as ground when standing on it would not require moving up. Feet at
     * or above the surface means it is floor; feet below it means the thing hit
     * is overhead.
     *
     * Using the feet rather than the origin matters — the origin sits a fixed
     * distance above the head, so comparing against it would reject the floor
     * itself for any character standing more than that distance above it, and
     * the character would fall forever the moment they left the ground. */
    const feetY = translation.y - PLAYER.CAPSULE_HALF_HEIGHT - PLAYER.CAPSULE_RADIUS

    const isFloor = surfaceY !== null && surfaceY <= feetY + GROUND_SNAP_TOLERANCE

    const floorStandHeight =
      isFloor && surfaceY !== null
        ? surfaceY + PLAYER.CAPSULE_HALF_HEIGHT + PLAYER.CAPSULE_RADIUS
        : null

    /* Grounded means "the floor can hold me up right now", not merely "there is
       floor beneath me".
     *
     * A ray still finds the floor for several frames after a jump — the body
     * only clears its own capsule height after the rise is well under way — so
     * arming `grounded` on the ray alone lets the character jump again on the
     * very next frame. Each press stacks another JUMP_VELOCITY on top of the
     * leftover upward velocity, and holding or tapping space flies the player
     * out of the world instead of hopping.
     *
     * While moving upward the character is airborne by definition, so the floor
     * is not consulted. The ray is also given a little hysteresis (the snap
     * tolerance) below, which is what keeps a standing character from flickering
     * between grounded and not on a floating-point boundary. */
    grounded.current =
      floorStandHeight !== null &&
      verticalVelocity.current <= 0 &&
      jumpLockout.current <= 0
    ;(window as unknown as { __cqG?: unknown }).__cqG = {
      y: Math.round(translation.y * 100) / 100,
      toi: hit ? Math.round(hit.timeOfImpact * 100) / 100 : null,
      surfaceY: surfaceY === null ? null : Math.round(surfaceY * 100) / 100,
      feetY: Math.round(feetY * 100) / 100,
      isFloor,
      stand: floorStandHeight === null ? null : Math.round(floorStandHeight * 100) / 100,
      hitY: hit ? Math.round(((hit.collider as unknown as { translation: () => { y: number } })?.translation?.().y ?? -999) * 100) / 100 : null,
      hitX: hit ? Math.round(((hit.collider as unknown as { translation: () => { x: number } })?.translation?.().x ?? -999) * 100) / 100 : null,
    }

    /* Input. Blocked input still reports its axis so the character decelerates
       smoothly rather than stopping dead when a dialogue opens. */
    const blocked = isInputBlocked()
    inputState.moveAxis(scratch.axis)

    const moveX = blocked ? 0 : scratch.axis.x
    const moveY = blocked ? 0 : scratch.axis.y
    const wantsRun = !blocked && inputState.isActive('run')
    const targetSpeed = wantsRun ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED

    /* Camera-relative movement: W always goes away from the camera. */
    const yaw = cameraRig.yaw
    scratch.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    scratch.right.set(Math.cos(yaw), 0, -Math.sin(yaw))

    scratch.movement
      .set(0, 0, 0)
      .addScaledVector(scratch.forward, moveY)
      .addScaledVector(scratch.right, moveX)

    const inputMagnitude = Math.min(scratch.movement.length(), 1)
    if (inputMagnitude > 0.001) scratch.movement.normalize()

    const linear = rb.linvel()
    const desiredSpeed = targetSpeed * inputMagnitude
    let targetVx = scratch.movement.x * desiredSpeed
    let targetVz = scratch.movement.z * desiredSpeed

    /*
     * Wall collision.
     *
     * The player is a `kinematicVelocity` body, and Rapier does **not** resolve
     * that body type against the world: it integrates the velocity it is given
     * and reports nothing back. A capsule driven this way walks straight
     * through every collider in the scene — the lab walls, the houses, the
     * village boundary — while `grounded` stays true, because the ground probe
     * is a ray cast that never asks a collider to push back. The symptom is a
     * player who can leave the world through any wall and never notice.
     *
     * Verified against Rapier directly: a dynamic body is stopped by a fixed
     * box at exactly its own radius from the face, while both kinematic types
     * pass through it untouched.
     *
     * So the sweep is done here instead. The character keeps kinematic movement
     * — which is what makes the controls crisp and lets nothing shove the
     * player around — and gains walls by clipping this frame's motion to the
     * first thing it would hit.
     */

    /*
     * The sweep runs along a *unit* direction with an explicit distance, rather
     * than along the frame's displacement. Shape-cast `time_of_impact` is
     * measured in the units of the swept vector, so casting along a 0.07-unit
     * step would put every result in the range 0..0.07 and make the arithmetic
     * below meaningless. A fixed look-ahead keeps the numbers in metres.
     */
    const speed = Math.hypot(targetVx, targetVz)

    /* Where the wall stops the player, when one is found this frame. `null`
       means nothing was in the way and the eased velocity stands. */
    let wallLimit: number | null = null
    let wallDirX = 0
    let wallDirZ = 0

    if (speed > 0.001) {
      const dirX = targetVx / speed
      const dirZ = targetVz / speed

      /* Look ahead by this frame's travel plus the capsule's radius, so the wall
         is noticed before the body reaches it rather than after. */
      const reach = speed * delta + WALL_PROBE_RADIUS

      /* Rays, not a shape cast.
       *
       * A swept ball was tried first and abandoned: Rapier reports a shape cast
       * that starts in contact as `time_of_impact` zero *regardless of how far
       * the face actually is* — a ball of the capsule's radius already touching
       * a wall reports 0 even with 0.29 units still to go, which is
       * indistinguishable from being embedded in it. The result was a stop that
       * arrived a frame late, after the character was already through a 0.3-thick
       * wall.
       *
       * A thin fan of rays has no such ambiguity: each one reports the true
       * distance to the surface it hits. Casting across the capsule's width as
       * well as its centre is what makes the fan a stand-in for the body — a
       * single centre ray would let the character clip a corner.
       */
      const sideX = -dirZ
      const sideZ = dirX

      /* Three rays across the capsule: one down the centre line, one grazing
         each edge a character of this radius would occupy. A single centre ray
         would let the body clip a doorframe or a corner, because the capsule's
         shoulder reaches half a metre either side of it.
       *
       * No nested loop here. An earlier version used `i` over -1..1 and `j` over
         0..1 with the offset scaled by `j`, which made all three `j = 0` rays
         identical — five casts per frame, three of them the same centre line. */
      for (let i = -1; i <= 1; i += 1) {
        const offset = i * WALL_PROBE_RADIUS
        const originX = translation.x + sideX * offset
        const originZ = translation.z + sideZ * offset

        const rayHit = world.castRay(
          new rapier.Ray(
            { x: originX, y: translation.y, z: originZ },
            { x: dirX, y: 0, z: dirZ },
          ),
          reach,
          true,
          undefined,
          undefined,
          undefined,
          rb,
        )

        /* How far the capsule's *centre* may still move along `dir` before the
           body's surface would touch what the ray found.
         *
         * The rays are cast from the centre line and its two edge offsets, so a
         * hit distance is measured from the centre. The body may therefore only
         * cover that distance minus its own radius — otherwise the centre is
         * allowed to travel all the way to the face and the capsule ends up
         * embedded in the wall, overlapping it by a full radius.
         *
         * That overlap is not merely untidy: a body flush with a wall makes the
         * downward ground ray start exactly *on* the wall's surface, where
         * Rapier reports `toi 0` and a surface height of the ray's own origin.
         * The height test then rejects it as "overhead", the floor is lost, and
         * the character sinks through the world beside the wall. Leaving the
         * radius of clearance is what keeps the ground probe honest. */
        if (rayHit) {
          const toSurface = rayHit.timeOfImpact - PLAYER.CAPSULE_RADIUS - WALL_SKIN
          if (wallLimit === null || toSurface < wallLimit) {
            wallLimit = toSurface
            wallDirX = dirX
            wallDirZ = dirZ
          }
        }
      }
    }

    // Ease toward the target velocity for weight, without sluggishness.
    let newVx = damp(linear.x, targetVx, PLAYER.ACCEL_LERP, delta)
    let newVz = damp(linear.z, targetVz, PLAYER.ACCEL_LERP, delta)

    /* A wall is a hard limit, not a target to ease toward.
     *
     * Damping alone leaves the player drifting into the wall: `damp` only
     * removes about a fifth of the speed per frame, so the character keeps
     * creeping forward for several frames after the sweep has already reported
     * contact. Once the body is inside the wall the sweep starts *in* the
     * geometry and clamps to zero, which lets it keep sliding until it is
     * through.
     *
     * The limit is applied to the *distance* the movement may cover, not to the
     * velocity. Clamping velocity needs the wall's normal, and the fan only
     * knows a travel distance per ray; working in distance keeps the two in the
     * same units and makes the touching case — where the allowed travel is
     * zero — fall out naturally instead of dividing by it. */
    if (wallLimit !== null) {
      const permitted = Math.max(wallLimit, 0)
      const wanted = Math.hypot(newVx, newVz) * delta

      if (wanted > permitted) {
        /* Scale the whole velocity so this frame's travel matches the limit,
           which preserves the direction the player was already moving in. */
        const scale = permitted / wanted
        newVx *= scale
        newVz *= scale
        void wallDirX
        void wallDirZ
      }
    }
    playerTransform.wallLimit = wallLimit

    /* Jump and gravity. */
    if (jumpLockout.current > 0) jumpLockout.current = Math.max(0, jumpLockout.current - delta)

    const wantsJump = !blocked && inputState.consumePress('jump')
    if (wantsJump && grounded.current) {
      verticalVelocity.current = PLAYER.JUMP_VELOCITY
      grounded.current = false
      /* Long enough to clear the ground ray's reach even on a slow frame, so the
         character is unambiguously in the air before grounding is reconsidered. */
      jumpLockout.current = JUMP_LOCKOUT
      ;(window as unknown as { __cqJumps?: number }).__cqJumps =
        ((window as unknown as { __cqJumps?: number }).__cqJumps ?? 0) + 1
    }

    if (!grounded.current) {
      verticalVelocity.current += PHYSICS.GRAVITY * delta
      // Terminal velocity so a long fall cannot tunnel through the ground.
      verticalVelocity.current = Math.max(verticalVelocity.current, -32)
    } else if (verticalVelocity.current < 0) {
      verticalVelocity.current = 0
    }

    /* Hold the player on the floor.
     *
     * Rapier applies no collision response to a `kinematicVelocity` body, so
     * nothing holds the character up: gravity walks them down through the floor
     * until the ground ray loses sight of it entirely. The ray measures the
     * surface, and this places the body on it.
     *
     * A positional correction, not a velocity. Damping the descent reads the
     * gap *before* the frame's motion, so a fast-moving body crosses the
     * surface within a single step: the correction sees a small gap, applies a
     * small push, and the accumulated velocity carries the character through
     * anyway. Writing the position is legitimate precisely because the body is
     * kinematic — its transform is ours to place.
     *
     * Only applied while descending or level. A jump sets an upward velocity
     * and clears `grounded`, and the snap must not fight it; `standHeight` also
     * only exists when the ray found a surface, so a character in the air is
     * left alone. */
    let resolvedY: number | null = null

    if (grounded.current && floorStandHeight !== null) {
      /* Snap in either direction. Snapping only downward would leave a body
         that had already sunk to be corrected by gravity, which is what sank it
         in the first place. */
      resolvedY = floorStandHeight
      verticalVelocity.current = 0
    }

    rb.setLinvel({ x: newVx, y: verticalVelocity.current, z: newVz }, true)

    /* Apply the floor correction positionally, after the velocity is written —
       Rapier integrates the body from here, so a lift applied first would be
       undone by the same frame's downward motion. */
    if (resolvedY !== null && resolvedY !== translation.y) {
      rb.setTranslation(
        { x: translation.x, y: resolvedY, z: translation.z },
        true,
      )
    }

    /* Facing follows the movement direction, not the camera. */
    const horizontalSpeed = Math.hypot(newVx, newVz)
    if (inputMagnitude > 0.05) {
      const targetHeading = Math.atan2(-scratch.movement.x, -scratch.movement.z)
      heading.current = dampAngle(
        heading.current,
        targetHeading,
        PLAYER.TURN_LERP,
        delta,
      )
    }

    /* Publish the transform for the camera, detector and minimap.

       The y is taken from the resolved value rather than read back from the
       body: `setTranslation` is not reflected by `translation()` until Rapier
       next steps, so reading it here would publish last frame's height and let
       the camera lag a frame behind the floor correction. */
    const pos = rb.translation()
    playerTransform.position.set(
      pos.x,
      resolvedY ?? pos.y,
      pos.z,
    )
    playerTransform.heading = heading.current
    playerTransform.grounded = grounded.current
    playerTransform.speed = Math.min(horizontalSpeed / PLAYER.RUN_SPEED, 1)

    /* Animation state selection. */
    const now = performance.now()
    let next: CharacterState

    if (now < oneShotUntil.current) {
      next = currentState.current
    } else if (!grounded.current) {
      next = verticalVelocity.current > 0 ? 'jump' : 'fall'
    } else if (horizontalSpeed > PLAYER.WALK_SPEED + 0.4) {
      next = 'run'
    } else if (horizontalSpeed > 0.25) {
      next = 'walk'
    } else {
      next = 'idle'
    }

    if (next !== currentState.current) {
      currentState.current = next
      setRenderState(next)
    }

    // Publish a speed band rather than the raw value, so the visual only
    // re-renders when the gait meaningfully changes.
    const band = Math.round(Math.min(horizontalSpeed / PLAYER.WALK_SPEED, 1.6) * 4) / 4
    if (band !== speed) setSpeed(band)

    /* One-frame press flags are deliberately NOT cleared here.
       `endFrame` used to be called at this point, which meant the interact
       press was erased by the player's frame — R3F's render loop runs before
       the interaction handler's own requestAnimationFrame callback, so 'E' was
       consumed by nobody and the player could never use anything. The handler
       owns that flag's lifetime and calls `endFrame` after it has read it. */
    void dialogueActive
  })

  return (
    <>
      <PlayerBody spawn={PLAYER_SPAWN} onReady={handleReady} />
      <CharacterVisual target={playerTransform.position} state={renderState} speed={speed} headingRef={heading} />
    </>
  )
}

/**
 * Purely visual follower. Renders the character mesh at the physics body's
 * position every frame — kept separate so its re-renders never touch the
 * controller's per-frame work.
 */
function CharacterVisual({
  target,
  state,
  speed,
  headingRef,
}: {
  target: Vector3
  state: CharacterState
  speed: number
  headingRef: React.RefObject<number>
}) {
  const group = useRef<Group>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.position.set(target.x, target.y, target.z)
    g.rotation.y = headingRef.current ?? 0
  })

  return (
    <group ref={group}>
      <CharacterModel state={state} speed={speed} />
    </group>
  )
}

/**
 * Imperative bridge so game systems outside the React tree (interaction
 * handlers, quest rewards) can trigger a one-shot animation such as a wave.
 */
export const characterAnimator = {
  play: (_state: CharacterState, _durationMs: number) => {},
}

export function playCharacterAnimation(
  state: CharacterState,
  durationMs = 1200,
): void {
  characterAnimator.play(state, durationMs)
}
