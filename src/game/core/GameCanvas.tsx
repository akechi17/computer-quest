import { Suspense } from 'react'
import { create } from 'zustand'
import { Canvas } from '@react-three/fiber'
import { PCFShadowMap } from 'three'
import { AdaptiveDpr, AdaptiveEvents, Preload } from '@react-three/drei'
import { Physics, type RapierRigidBody } from '@react-three/rapier'
import { CAMERA, PHYSICS, RENDER } from '@/utils/constants'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { useInteractionStore } from '@/game/interaction/interactionStore'
import { FIRST_QUEST_ID, getQuest } from '@/data/quests'
import { GameLighting } from './GameLighting'
import { useKeyboardInput } from './useKeyboardInput'
import { useInteractionDetector } from '@/game/interaction/useInteractionDetector'
import { useInteractionHandler } from '@/game/interaction/useInteractionHandler'
import { useQuestEngine } from '@/game/quests/useQuestEngine'
import { useGameClock } from './useGameClock'
import { PlayerController } from '@/game/player/PlayerController'
import { ThirdPersonCamera, cameraRig } from '@/game/camera/ThirdPersonCamera'
import { ComputerVillage } from '@/scenes/ComputerVillage/ComputerVillage'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { playerTransform } from './playerTransform'

/**
 * The player's live Rapier body, published so systems outside the physics tree
 * (the test probe, and later save/load) can address it without prop-drilling
 * a ref through the whole scene. Non-reactive: it is read on demand, never
 * rendered from.
 *
 * `faceHeading` is how the teleport aims the character. The controller owns
 * the heading in a ref and re-derives it from movement, so setting the shared
 * transform alone would be overwritten on the next frame.
 */
export const usePlayerBodyStore = create<{
  body: RapierRigidBody | null
  faceHeading: ((heading: number) => void) | null
  setBody: (body: RapierRigidBody | null) => void
  setFaceHeading: (fn: ((heading: number) => void) | null) => void
}>((set) => ({
  body: null,
  faceHeading: null,
  setBody: (body) => set({ body }),
  setFaceHeading: (fn) => set({ faceHeading: fn }),
}))

/** How far above the ground the test teleport drops the player, in units. */
const DROP_HEIGHT = 6

/**
 * The test probe installed on the canvas element. Kept as an interface so the
 * augmentation below stays honest about what is actually exposed.
 */
declare global {
  interface HTMLCanvasElement {
    __cq?: () => {
      x: number
      y: number
      z: number
      grounded: boolean
      speed: number
      /** Live camera orbit yaw, which movement is relative to. */
      yaw: number
      /** Which object or NPC the player could currently use, if any. */
      nearest: string | null
      /** The active quest's next objective, or null when none is pending. */
      objective: string | null
      questStatus: string
      items: string[]
      overlay: string
      dialogue: string | null
      /** Every badge the player has earned, by id. */
      badges: string[]
      /** Every lesson the player has been taught, by id. */
      lessons: string[]
      /** How far the player may still travel before a wall stops them, or null
          when nothing is in the way. Lets a test tell "the wall held" apart from
          "there was no wall to hit". */
      wall: number | null
    }
  }

  interface Window {
    /**
     * Moves the player for the quest-chain test (`scripts/test-quest-chain.mjs`).
     * Kept alongside the canvas probe rather than in its own module so both
     * test affordances are added and removed together.
     */
    __cqTeleport?: (x: number, z: number, heading?: number) => void
    /**
     * Unlocks a zone directly, for `scripts/test-hardware-lab.mjs`.
     *
     * The lab's contents are gated on the lab pass, which only the full quest
     * awards. Replaying the quest in the lab test would make it fail for
     * reasons unrelated to the lab — and would duplicate coverage that
     * `test-quest-chain.mjs` already owns — so the lab test reaches for the
     * unlock directly instead.
     */
    __cqUnlockZone?: (zoneId: string) => void
  }
}

/**
 * The game canvas and the systems that live inside it.
 *
 * Before the player starts, the canvas renders only a lightweight backdrop —
 * the whole village is mounted on demand, which is what keeps the title screen
 * snappy on a school laptop (spec §29, §30).
 */
export function GameCanvas() {
  const quality = useSettingsStore((s) => s.quality)
  const dprCap = quality === 'low' ? 1 : RENDER.MAX_DPR

  return (
    <Canvas
      /* three r186 deprecated PCFSoftShadowMap and, because React Three Fiber
         maps its `shadows="soft"` string onto exactly that constant, the string
         form always emits a deprecation warning. Passing the shadow-map
         settings directly avoids the warning and pins the behaviour we want. */
      shadows={
        quality !== 'low'
          ? { type: PCFShadowMap, enabled: true, autoUpdate: true }
          : false
      }
      dpr={[RENDER.MIN_DPR, dprCap]}
      camera={{
        fov: CAMERA.FOV,
        near: CAMERA.NEAR,
        far: CAMERA.FAR,
        position: [0, 6, 14],
      }}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        // Stencil is unused; disabling it saves memory and a little bandwidth.
        stencil: false,
      }}
      // Clamp the pixel ratio under load rather than dropping frames.
      performance={{ min: 0.6 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#8ec9e8')

        /* Expose a tiny read-only probe for the automated movement test
           (`scripts/test-movement.mjs`). Without it the test could only assert
           that a canvas exists, which is exactly what failed to catch the
           player falling through a world with no ground collider. Reading the
           live transform is the difference between "the scene rendered" and
           "the character is standing on something". */
        const canvas = gl.domElement
        canvas.__cq = () => {
          const progress = useProgressStore.getState()
          const quest = getQuest(FIRST_QUEST_ID)
          return {
            x: playerTransform.position.x,
            y: playerTransform.position.y,
            z: playerTransform.position.z,
            grounded: playerTransform.grounded,
            speed: playerTransform.speed,
            /* Movement is camera-relative, so a test that presses 'W' needs to
               know which way the camera is facing to predict where the player
               goes. Without this, a walk assertion silently measures the wrong
               axis. */
            yaw: cameraRig.yaw,
            nearest: useInteractionStore.getState().nearest?.id ?? null,
            objective: quest ? progress.activeObjectiveId(quest) : null,
            questStatus: progress.getQuestStatus(FIRST_QUEST_ID),
            items: progress.inventory.map((entry) => entry.itemId),
            overlay: useSessionStore.getState().overlay,
            dialogue: useSessionStore.getState().dialogue?.treeId ?? null,
            badges: progress.badges,
            lessons: progress.completedLessonIds,
            wall: playerTransform.wallLimit,
          }
        }

        /* Teleport for the quest-chain test. The rig is parked high above the
           target and allowed to fall, so the character lands through the same
           physics path it always uses — writing a y directly would let the
           test pass on a world with no ground under it.

           `heading` is set as well because the interaction detector prefers
           whatever the player is facing. Objects that sit close together (the
           monitor and keyboard are 1.5 units apart) are otherwise a coin flip,
           and the test would report a quest bug that is really an aiming
           problem. Heading only normally changes while moving, so a teleported
           player would keep facing wherever they last walked. */
        window.__cqTeleport = (x, z, heading) => {
          const store = usePlayerBodyStore.getState()
          if (!store.body) return
          if (typeof heading === 'number') store.faceHeading?.(heading)
          playerTransform.position.set(x, DROP_HEIGHT, z)
          store.body.setTranslation({ x, y: DROP_HEIGHT, z }, true)
          store.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }

        /* Direct zone unlock for the Hardware Lab test. The lab's exhibits are
           gated on the lab pass, which only the quest awards; replaying the
           quest to reach them would make the lab test fail for reasons that
           have nothing to do with the lab. */
        window.__cqUnlockZone = (zoneId) => {
          useProgressStore.getState().unlockZone(zoneId)
        }
      }}
    >
      <ErrorBoundary
        fallback={<FallbackScene />}
        onError={(error) => console.error('[Computer Quest] scene error', error)}
      >
        <Suspense fallback={null}>
          <GameSystems />
        </Suspense>
      </ErrorBoundary>

      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  )
}

/**
 * Everything that must exist whether or not the world is loaded: lighting,
 * physics, the player, and the per-frame systems.
 */
function GameSystems() {
  const started = useSessionStore((s) => s.started)

  useKeyboardInput(started)
  useInteractionDetector(started)
  useInteractionHandler()
  useQuestEngine(started)
  useGameClock(started)

  return (
    <>
      <GameLighting />
      <Physics
        gravity={[0, PHYSICS.GRAVITY, 0]}
        timeStep={PHYSICS.TIME_STEP}
        // Interpolation smooths the visual between fixed steps, which matters
        // because we render at display rate but simulate at 60Hz.
        interpolate
      >
        {started ? <PlayerController /> : null}
        <ComputerVillage />
        {/* The camera casts a ray against the physics world to keep itself out
            of walls, so it must be a child of <Physics> — `useRapier` throws
            when called outside the provider. */}
        <ThirdPersonCamera />
      </Physics>
      <Preload all />
    </>
  )
}

/** Shown if the 3D scene throws, instead of a white screen (spec §30). */
function FallbackScene() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#1c2740" />
    </mesh>
  )
}
