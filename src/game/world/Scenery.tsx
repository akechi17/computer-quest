import { useMemo, useRef } from 'react'
import { Instance, Instances } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Group } from 'three'
import { useReducedMotion } from '@/game/core/useReducedMotion'

/**
 * Non-interactive village scenery: buildings, trees, lamps, fences and the
 * ground paths.
 *
 * Performance notes (spec §29): everything repeated — trees, lamps, fence
 * posts, path tiles — is drawn with drei's <Instances>, so a hundred trees cost
 * one draw call. Nothing here casts shadows except the buildings, because the
 * shadow map is the single most expensive thing in the scene.
 */

/* -------------------------------------------------------------------------- */
/* Paths                                                                       */
/* -------------------------------------------------------------------------- */

const PATH_TILES: Array<[number, number, number]> = [
  // Plaza to the computer
  [0, -3, 2.6],
  [0, -5, 2.6],
  [0, -9, 2.6],
  // Plaza to the guide
  [2.2, -1.2, 1.6],
  // Plaza toward the lab gate
  [0, -14, 3.2],
  [0, -18, 3.2],
  [0, -22, 3.2],
  // Branch to the Memory Garden
  [5, -16, 2.2],
  [9, -15, 2.2],
  // Branch to the storage warehouse
  [-2, 7, 2.6],
  [-1, 11, 2.6],
  [0, 15, 2.6],
  // Branch to the network tower
  [6, 2, 2.4],
  [11, 2, 2.4],
  [15, 2, 2.4],
  // Branch to the digital forest
  [-6, 3, 2.4],
  [-11, 3.5, 2.4],
  [-15, 4, 2.4],
]

export function Paths() {
  return (
    <Instances limit={PATH_TILES.length} receiveShadow>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color="#c2a878" roughness={0.95} />
      {PATH_TILES.map(([x, z, size], index) => (
        <Instance
          key={index}
          position={[x, 0.02, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={size}
        />
      ))}
    </Instances>
  )
}

/* -------------------------------------------------------------------------- */
/* Trees — the "Digital Forest" and village greenery                           */
/* -------------------------------------------------------------------------- */

/**
 * Trees are stored as compact `[x, z, scale]` tuples — there are 40 of them and
 * writing them as objects would triple the noise for no benefit. The `tint`
 * is derived from the index so neighbouring trees do not match exactly.
 */
type TreeTuple = readonly [x: number, z: number, scale: number]

/** Hand-placed rather than random, so the layout is reproducible across runs. */
const TREES: readonly TreeTuple[] = [
  // Digital Forest (west)
  [-16, 8, 1.25], [-19, 5, 1.0], [-14, 3, 1.1], [-21, 9, 0.95],
  [-17, 12, 1.15], [-22, 2, 1.05], [-13, 7, 0.9], [-24, 6, 1.2],
  [-20, 14, 1.0], [-15, 15, 1.1], [-26, 11, 0.95], [-12, 12, 0.85],
  [-18, -3, 1.1], [-24, -2, 1.0], [-13, -5, 1.2], [-27, 4, 1.05],
  // Around the plaza, kept clear of the paths and the computer
  [7, -6, 0.95], [-7, -8, 1.0], [9, -9, 0.85], [-9, -4, 0.9],
  [11, 8, 1.05], [-10, 12, 0.95], [6, 12, 1.0], [-6, 16, 0.9],
  // Memory Garden border (east of the plaza)
  [16, -16, 1.0], [19, -12, 0.9], [13, -19, 1.1], [21, -17, 1.0],
  [17, -21, 0.95], [23, -13, 0.85],
  // Storage warehouse approach (south)
  [5, 19, 1.0], [-5, 21, 1.1], [8, 23, 0.9], [-8, 24, 1.0],
  // Boundary dressing, so the village feels enclosed
  [24, 6, 1.1], [26, 14, 1.0], [22, 20, 1.05], [14, 26, 1.0],
  [-26, 22, 1.1], [-29, 16, 1.0], [27, -8, 1.05], [25, -20, 1.0],
]

const TREE_TINTS = ['#3f8f5a', '#4fa06a', '#357a4d'] as const

export function Trees() {
  return (
    <group>
      {/* Trunks */}
      <Instances limit={TREES.length} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 2.2, 7]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
        {TREES.map(([x, z, scale], index) => (
          <Instance
            key={index}
            position={[x, 1.1 * scale, z]}
            scale={scale}
          />
        ))}
      </Instances>

      {/* Foliage — two stacked cones per tree, instanced separately */}
      <Instances limit={TREES.length * 2} castShadow>
        <coneGeometry args={[1.1, 1.8, 7]} />
        <meshStandardMaterial color="#3f8f5a" roughness={0.85} />
        {TREES.map(([x, z, scale], index) => (
          <Instance
            key={`lower-${index}`}
            position={[x, 2.4 * scale, z]}
            scale={scale}
            color={TREE_TINTS[index % TREE_TINTS.length]}
          />
        ))}
        {TREES.map(([x, z, scale], index) => (
          <Instance
            key={`upper-${index}`}
            position={[x, 3.5 * scale, z]}
            scale={scale * 0.72}
            color={TREE_TINTS[(index + 1) % TREE_TINTS.length]}
          />
        ))}
      </Instances>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Buildings                                                                   */
/* -------------------------------------------------------------------------- */

interface BuildingSpec {
  position: [number, number, number]
  size: [number, number, number]
  rotationY?: number
  body: string
  roof: string
  /** Emissive window colour, or null for an unlit structure. */
  windows: string | null
}

const BUILDINGS: BuildingSpec[] = [
  /* The Hardware Lab used to be an entry here. It is now a room the player can
     walk into, so it is drawn by `HardwareLab.tsx`, which needs the walls
     split around a doorway and pairs each piece with its own collider. */
  // Storage Warehouse — south, standing in for HDD/SSD
  {
    position: [0, 0, 20],
    size: [11, 4.5, 8],
    body: '#7a5c3e',
    roof: '#5a4229',
    windows: '#fbbf24',
  },
  // Network Tower building — east
  {
    position: [19, 0, 2],
    size: [7, 8, 7],
    body: '#2f4a5e',
    roof: '#1f3345',
    windows: '#38bdf8',
  },
  // Village houses around the plaza
  {
    position: [12, 0, -6],
    size: [5, 3.4, 5],
    rotationY: 0.3,
    body: '#c98a6b',
    roof: '#8f5a44',
    windows: '#fde68a',
  },
  {
    position: [-12, 0, -9],
    size: [4.5, 3, 4.5],
    rotationY: -0.4,
    body: '#a8b4d4',
    roof: '#6b7899',
    windows: '#fde68a',
  },
  {
    position: [-6, 0, 20],
    size: [5, 3.6, 5],
    rotationY: 0.15,
    body: '#c9a86b',
    roof: '#8f7444',
    windows: '#fde68a',
  },
  {
    position: [8, 0, 17],
    size: [4.5, 3.2, 4.5],
    rotationY: -0.25,
    body: '#b47a9a',
    roof: '#7d5269',
    windows: '#fde68a',
  },
]

export function Buildings() {
  return (
    <group>
      {BUILDINGS.map((building, index) => {
        const windowColor = building.windows
        return (
        <group
          key={index}
          position={building.position}
          rotation={[0, building.rotationY ?? 0, 0]}
        >
          {/* Body */}
          <mesh castShadow receiveShadow position={[0, building.size[1] / 2, 0]}>
            <boxGeometry args={building.size} />
            <meshStandardMaterial color={building.body} roughness={0.75} />
          </mesh>

          {/* Roof — a slightly wider flat cap reads as stylised without a
              custom roof mesh. */}
          <mesh
            castShadow
            position={[0, building.size[1] + 0.2, 0]}
          >
            <boxGeometry
              args={[building.size[0] + 0.7, 0.4, building.size[2] + 0.7]}
            />
            <meshStandardMaterial color={building.roof} roughness={0.8} />
          </mesh>

          {/* Windows. Instanced per building would be overkill at this count. */}
          {windowColor === null
            ? null
            : [-1, 0, 1].map((column) =>
                [0.35, 0.62].map((rowFraction) => (
                  <mesh
                    key={`${column}-${rowFraction}`}
                    position={[
                      column * (building.size[0] * 0.26),
                      building.size[1] * rowFraction,
                      -building.size[2] / 2 - 0.02,
                    ]}
                  >
                    <planeGeometry args={[1.0, 0.75]} />
                    <meshStandardMaterial
                      color={windowColor}
                      emissive={windowColor}
                      emissiveIntensity={0.5}
                      roughness={0.3}
                      toneMapped={false}
                    />
                  </mesh>
                )),
              )}
        </group>
        )
      })}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Street lamps — instanced post + glowing head                                */
/* -------------------------------------------------------------------------- */

const LAMP_POSITIONS: Array<[number, number]> = [
  [3.5, -4], [-3.5, -4], [3.5, 4], [-3.5, 4],
  [4, -13], [-4, -13], [8, 2], [-8, 3],
  [4, 10], [-4, 12], [12, 2], [-12, 4],
]

export function Lamps() {
  const heads = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!heads.current || reducedMotion) return
    // A barely-perceptible flicker; enough to feel alive, not enough to annoy.
    const t = state.clock.elapsedTime
    heads.current.children.forEach((child, index) => {
      const mesh = child as import('three').Mesh
      const material = mesh.material as import('three').MeshStandardMaterial
      material.emissiveIntensity = 1.4 + Math.sin(t * 1.7 + index * 2.1) * 0.08
    })
  })

  return (
    <group>
      <Instances limit={LAMP_POSITIONS.length} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 3.4, 8]} />
        <meshStandardMaterial color="#2b3446" roughness={0.6} metalness={0.4} />
        {LAMP_POSITIONS.map(([x, z], index) => (
          <Instance key={index} position={[x, 1.7, z]} />
        ))}
      </Instances>

      <group ref={heads}>
        {LAMP_POSITIONS.map(([x, z], index) => (
          <mesh key={index} position={[x, 3.5, z]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial
              color="#ffe9b0"
              emissive="#ffd980"
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Fence around the village edge — visual boundary for the invisible walls     */
/* -------------------------------------------------------------------------- */

export function Fences() {
  const posts = useMemo(() => {
    const result: Array<[number, number, number]> = []
    const half = 44
    const step = 4
    for (let i = -half; i <= half; i += step) {
      result.push([i, 0, -half])
      result.push([i, 0, half])
      result.push([-half, 0, i])
      result.push([half, 0, i])
    }
    return result
  }, [])

  return (
    <Instances limit={posts.length} castShadow>
      <boxGeometry args={[0.18, 1.2, 0.18]} />
      <meshStandardMaterial color="#8a6f4a" roughness={0.9} />
      {posts.map(([x, y, z], index) => (
        <Instance key={index} position={[x, y + 0.6, z]} />
      ))}
    </Instances>
  )
}

/* -------------------------------------------------------------------------- */
/* Sky                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A stylised sky dome: one large back-facing sphere. No cubemap, no texture
 * download, no seams — and it matches the low-poly art direction (spec §3).
 *
 * The gradient comes from drei's <Sky> being overkill here, so we use a flat
 * horizon colour and let the scene fog do the blending toward the horizon.
 */
export function SkyDome() {
  return (
    <mesh scale={180} renderOrder={-1}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial color="#8ec9e8" side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}
