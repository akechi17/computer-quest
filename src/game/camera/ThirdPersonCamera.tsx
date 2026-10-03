import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { CAMERA } from '@/utils/constants'
import { clamp, damp } from '@/utils/math'
import { playerTransform } from '@/game/core/playerTransform'
import { useSessionStore } from '@/stores/sessionStore'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * Third-person follow camera (spec §9).
 *
 * Behaviour:
 *  - Mouse (or a drag on touch) orbits yaw/pitch around the player.
 *  - Position is exponentially damped toward the ideal spot, so the camera
 *    trails rather than snaps.
 *  - A short raycast from the player toward the camera pulls it in when a wall
 *    is in the way, preventing the clipping the spec calls out.
 *  - The yaw is published so the player controller can move camera-relative.
 */

const scratch = {
  ideal: new Vector3(),
  target: new Vector3(),
  direction: new Vector3(),
}

/** Shared so the player controller can read the current orbit yaw. */
export const cameraRig = {
  yaw: 0,
  pitch: 0.3,
}

export function ThirdPersonCamera() {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()

  const yaw = useRef(0)
  const pitch = useRef(0.3)
  const currentDistance = useRef<number>(CAMERA.DISTANCE)
  const smoothedTarget = useRef(new Vector3(0, 1.4, 0))
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })

  const invertY = useSettingsStore((s) => s.invertCameraY)
  const reducedMotion = useSettingsStore((s) => s.reducedMotion === 'reduced')
  const isInputBlocked = useSessionStore((s) => s.isInputBlocked)

  /* ---------------------------------------------------------------------- */
  /* Pointer orbit                                                           */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const element = gl.domElement

    const onPointerDown = (event: PointerEvent) => {
      // Only the primary button orbits; the right button stays free for menus.
      if (event.button !== 0) return
      dragging.current = true
      lastPointer.current = { x: event.clientX, y: event.clientY }
      element.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return
      const dx = event.clientX - lastPointer.current.x
      const dy = event.clientY - lastPointer.current.y
      lastPointer.current = { x: event.clientX, y: event.clientY }
      applyLook(dx, dy)
    }

    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId)
      }
    }

    const applyLook = (dx: number, dy: number) => {
      yaw.current -= dx * CAMERA.ROTATE_SENSITIVITY
      const pitchDelta = dy * CAMERA.ROTATE_SENSITIVITY * (invertY ? -1 : 1)
      pitch.current = clamp(
        pitch.current + pitchDelta,
        CAMERA.MIN_PITCH,
        CAMERA.MAX_PITCH,
      )
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)

    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
    }
  }, [gl, invertY])

  /* ---------------------------------------------------------------------- */
  /* Optional pointer-lock style free look with the right mouse button       */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const element = gl.domElement
    const onContextMenu = (event: MouseEvent) => event.preventDefault()
    element.addEventListener('contextmenu', onContextMenu)
    return () => element.removeEventListener('contextmenu', onContextMenu)
  }, [gl])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)

    // Publish the orbit yaw so movement is camera-relative.
    cameraRig.yaw = yaw.current
    cameraRig.pitch = pitch.current

    const player = playerTransform.position

    /* Look-at point, damped so the camera does not jitter when the player
       lands or climbs a step. */
    scratch.target.set(
      player.x,
      player.y + CAMERA.TARGET_HEIGHT,
      player.z,
    )
    const followLambda = reducedMotion ? 30 : CAMERA.FOLLOW_LERP
    smoothedTarget.current.x = damp(
      smoothedTarget.current.x,
      scratch.target.x,
      followLambda,
      delta,
    )
    smoothedTarget.current.y = damp(
      smoothedTarget.current.y,
      scratch.target.y,
      followLambda,
      delta,
    )
    smoothedTarget.current.z = damp(
      smoothedTarget.current.z,
      scratch.target.z,
      followLambda,
      delta,
    )

    /* Ideal position: behind and above the look-at point. */
    const horizontal = Math.cos(pitch.current) * CAMERA.DISTANCE
    scratch.ideal.set(
      smoothedTarget.current.x + Math.sin(yaw.current) * horizontal,
      smoothedTarget.current.y + Math.sin(pitch.current) * CAMERA.DISTANCE,
      smoothedTarget.current.z + Math.cos(yaw.current) * horizontal,
    )

    /* Collision: cast from the look-at point toward the ideal position and
       stop short of whatever we hit (spec §9, "prevent camera clipping"). */
    let allowedDistance: number = CAMERA.DISTANCE
    scratch.direction.subVectors(scratch.ideal, smoothedTarget.current)
    const idealDistance = scratch.direction.length()

    if (world && idealDistance > 0.001 && !isInputBlocked()) {
      scratch.direction.normalize()
      const ray = new rapier.Ray(
        {
          x: smoothedTarget.current.x,
          y: smoothedTarget.current.y,
          z: smoothedTarget.current.z,
        },
        {
          x: scratch.direction.x,
          y: scratch.direction.y,
          z: scratch.direction.z,
        },
      )
      const hit = world.castRay(ray, idealDistance, true)
      if (hit) {
        const hitDistance = 'timeOfImpact' in hit ? hit.timeOfImpact : idealDistance
        allowedDistance = Math.max(hitDistance - CAMERA.COLLISION_PADDING, CAMERA.MIN_DISTANCE)
      }
    }

    // Pull in fast so the camera never intersects geometry, but ease back out
    // slowly, otherwise walking past a pillar causes a jarring zoom snap.
    const distanceLambda = allowedDistance < currentDistance.current ? 24 : 4
    currentDistance.current = damp(
      currentDistance.current,
      allowedDistance,
      distanceLambda,
      delta,
    )

    const finalHorizontal = Math.cos(pitch.current) * currentDistance.current
    camera.position.set(
      smoothedTarget.current.x + Math.sin(yaw.current) * finalHorizontal,
      smoothedTarget.current.y + Math.sin(pitch.current) * currentDistance.current,
      smoothedTarget.current.z + Math.cos(yaw.current) * finalHorizontal,
    )

    camera.lookAt(smoothedTarget.current)
  })

  return null
}

/** Jump the camera behind the player instantly — used on spawn and respawn. */
export function snapCameraBehindPlayer(): void {
  cameraRig.yaw = playerTransform.heading
}
