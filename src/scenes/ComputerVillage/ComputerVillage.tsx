import { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import { NPC_LIST, INTERACTIVES } from '@/data/world'
import { FIRST_QUEST_ID, getQuest } from '@/data/quests'
import { useProgressStore } from '@/stores/progressStore'
import { NpcModel } from '@/game/npc/NpcModel'
import { InteractableVisual } from '@/game/interaction/InteractableVisual'
import { visibleInteractives } from '@/game/interaction/visibility'
import { playerTransform } from '@/game/core/playerTransform'
import { Terrain } from '@/game/world/Terrain'
import { Buildings, Fences, Lamps, Paths, SkyDome, Trees } from '@/game/world/Scenery'
import { HardwareLab } from '@/game/world/HardwareLab'
import { Exhibits } from '@/game/world/Exhibits'
import {
  ComputerMonument,
  LabGate,
  MemoryGarden,
  NetworkTower,
  StorageWarehouse,
  VillageComputer,
} from '@/game/world/Landmarks'
import { RamModule } from '@/game/world/HardwareProps'
import { QuestBoard } from './QuestBoard'

/**
 * Computer Village — the MVP's playable area (spec §7).
 *
 * This component is deliberately a *composition*: it places scenery, NPCs and
 * interactables and wires them to stores. All behaviour lives in the systems
 * it pulls in. Nothing here contains quest or lesson logic (spec §39).
 */
export function ComputerVillage() {
  const quest = getQuest(FIRST_QUEST_ID)

  const questProgress = useProgressStore((s) => s.questProgress)
  const unlockedZoneIds = useProgressStore((s) => s.unlockedZoneIds)
  const completedLessonIds = useProgressStore((s) => s.completedLessonIds)
  const inventory = useProgressStore((s) => s.inventory)

  /* Which interactables currently exist. Recomputing this is cheap and the
     dependency list is exhaustive, so a quest step immediately reveals the
     RAM module and the lab gate's state. */
  const visible = useMemo(
    () =>
      visibleInteractives(useProgressStore.getState(), Object.values(INTERACTIVES)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questProgress, unlockedZoneIds, completedLessonIds, inventory],
  )

  /* The one object the active objective points at, for the highlight. */
  const objectiveTarget = useMemo(() => {
    if (!quest) return null
    const progress = useProgressStore.getState()
    if (progress.getQuestStatus(quest.id) !== 'active') return null
    const objectiveId = progress.activeObjectiveId(quest)
    if (!objectiveId) return null
    const objective = quest.objectives.find((o) => o.id === objectiveId)
    if (!objective) return null
    // Strip the zone prefix so it matches the local key in INTERACTIVES.
    const raw = objective.target
    const local = raw.includes(':') ? raw.split(':')[1] : raw
    return local ?? null
  }, [quest])

  const labUnlocked = unlockedZoneIds.includes('hardware-lab')
  const ramInstalled = useProgressStore((s) =>
    s.isObjectiveComplete(FIRST_QUEST_ID, 'install-ram'),
  )
  const computerPowered = useProgressStore((s) =>
    s.isObjectiveComplete(FIRST_QUEST_ID, 'install-ram'),
  )

  return (
    <group>
      {/* ---------------------------------------------------------------- */}
      {/* Environment                                                       */}
      {/* ---------------------------------------------------------------- */}
      <SkyDome />
      <Terrain />
      <Paths />
      <Trees />
      <Buildings />
      <Lamps />
      <Fences />

      {/* The Hardware Lab is both a building and a room: it draws its own
          walls around a doorway and owns their colliders. */}
      <HardwareLab />
      <Exhibits />

      {/* ---------------------------------------------------------------- */}
      {/* Landmarks                                                         */}
      {/* ---------------------------------------------------------------- */}
      <ComputerMonument />
      <MemoryGarden />
      <NetworkTower />
      <StorageWarehouse />

      {/* The quest's subject, with its state driven by progress. */}
      <VillageComputer
        powered={computerPowered}
        ramInstalled={ramInstalled}
        highlightedId={objectiveTarget}
      />

      {/* The lab gate is always drawn; only its colour and passability change.
          It sits flush against the doorway so it frames the way in, rather
          than standing in the grass several units short of the wall. */}
      <LabGate unlocked={labUnlocked} position={[0, 0, -27.4]} />

      {/* ---------------------------------------------------------------- */}
      {/* Interactables                                                     */}
      {/* ---------------------------------------------------------------- */}
      <StaticColliders />

      {/* Monitor — the object the quest's first inspection step points at */}
      {visible.has('village-computer-monitor') ? (
        <InteractableVisual
          definition={INTERACTIVES['village-computer-monitor']!}
          isObjectiveTarget={
            objectiveTarget === 'village-computer-monitor'
          }
        >
          {/* Visual is supplied by VillageComputer; this wrapper only adds
              the icon, label, ring and detection anchor. */}
          <mesh visible={false}>
            <boxGeometry args={[1.4, 0.9, 0.2]} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {visible.has('village-computer-keyboard') ? (
        <InteractableVisual
          definition={INTERACTIVES['village-computer-keyboard']!}
          isObjectiveTarget={objectiveTarget === 'village-computer-keyboard'}
        >
          <mesh visible={false}>
            <boxGeometry args={[1.1, 0.2, 0.4]} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {visible.has('village-computer-mouse') ? (
        <InteractableVisual
          definition={INTERACTIVES['village-computer-mouse']!}
          isObjectiveTarget={objectiveTarget === 'village-computer-mouse'}
        >
          <mesh visible={false}>
            <boxGeometry args={[0.3, 0.24, 0.3]} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {visible.has('village-computer-tower') ? (
        <InteractableVisual
          definition={INTERACTIVES['village-computer-tower']!}
          isObjectiveTarget={objectiveTarget === 'village-computer-tower'}
        >
          <mesh visible={false}>
            <boxGeometry args={[1.0, 1.8, 1.1]} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {/* Monument — the village's "what is a computer" lesson */}
      {visible.has('monument') ? (
        <InteractableVisual
          definition={INTERACTIVES['monument']!}
          isObjectiveTarget={objectiveTarget === 'monument'}
        >
          <mesh visible={false}>
            <boxGeometry args={[4.5, 5, 3]} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {/* The missing RAM module — only exists once the tower has been opened */}
      {visible.has('missing-ram') ? (
        <InteractableVisual definition={INTERACTIVES['missing-ram']!}>
          <group position={[0, 0.7, 0]} rotation={[0, 0.7, 0]}>
            <group rotation={[0, 0, Math.PI / 2]} scale={1.1}>
              <RamModule highlighted />
            </group>
          </group>
          <pointLight
            position={[0, 1.1, 0]}
            color="#38bdf8"
            intensity={5}
            distance={7}
            decay={2}
          />
          {/* A small pedestal, so it reads as "placed here" rather than
              dropped at random. */}
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.45, 0.55, 0.24, 12]} />
            <meshStandardMaterial color="#5a6478" roughness={0.7} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {/* Quest board */}
      {visible.has('quest-board') ? (
        <InteractableVisual definition={INTERACTIVES['quest-board']!}>
          <QuestBoard />
        </InteractableVisual>
      ) : null}

      {/* Lab gate interaction anchor */}
      {visible.has('lab-gate') ? (
        <InteractableVisual
          definition={INTERACTIVES['lab-gate']!}
          isObjectiveTarget={objectiveTarget === 'lab-gate'}
        >
          <mesh visible={false}>
            <boxGeometry args={[6, 4, 1]} />
          </mesh>
        </InteractableVisual>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* NPCs                                                              */}
      {/* ---------------------------------------------------------------- */}
      {Object.values(NPC_LIST).map((npc) => (
        <RigidBody key={npc.id} type="fixed" colliders="cuboid">
          <NpcModel definition={npc} playerPosition={playerTransform.position} />
        </RigidBody>
      ))}
    </group>
  )
}

/**
 * Invisible collision boxes matching the solid landmarks.
 *
 * Kept separate from the visual meshes so art can change without silently
 * changing where the player can walk. Radii are slightly generous so the
 * player never appears to clip a wall corner.
 */
function StaticColliders() {
  const boxes: Array<{
    position: [number, number, number]
    size: [number, number, number]
    rotationY?: number
  }> = [
    // Computer monument plinth
    { position: [0, 1.5, -12], size: [5.2, 3, 5.2] },
    // The village computer's desk and tower
    { position: [-0.6, 0.5, -7.4], size: [4.6, 1, 2.4], rotationY: 0.3 },
    { position: [0.6, 0.9, -7.9], size: [1.1, 1.8, 1.2], rotationY: 0.3 },
    // Hardware Lab building — the shell and its colliders live in
    // `HardwareLab.tsx`, split around the doorway.
    // Storage Warehouse walls
    { position: [-3.4, 2.2, 20], size: [0.4, 4.4, 7.4] },
    { position: [3.4, 2.2, 20], size: [0.4, 4.4, 7.4] },
    // Network Tower building
    { position: [19, 4, 2], size: [7, 8, 7] },
    // Village houses
    { position: [12, 1.7, -6], size: [5, 3.4, 5], rotationY: 0.3 },
    { position: [-12, 1.5, -9], size: [4.5, 3, 4.5], rotationY: -0.4 },
    { position: [-6, 1.8, 20], size: [5, 3.6, 5], rotationY: 0.15 },
    { position: [8, 1.6, 17], size: [4.5, 3.2, 4.5], rotationY: -0.25 },
    // Memory Garden pedestal
    { position: [14, 0.6, -14], size: [1.2, 1.2, 1.2] },
  ]

  return (
    <>
      {boxes.map((box, index) => (
        <RigidBody
          key={index}
          type="fixed"
          colliders="cuboid"
          position={box.position}
          rotation={[0, box.rotationY ?? 0, 0]}
        >
          <mesh visible={false}>
            <boxGeometry args={box.size} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}
