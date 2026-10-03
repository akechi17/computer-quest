import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { useReducedMotion } from '@/game/core/useReducedMotion'
import { RamModule, RouterProp } from './HardwareProps'

/**
 * The village's set-piece landmarks (spec §7).
 *
 * Each landmark is a *visual metaphor* for a computer concept, because the
 * spec's core idea is that the world itself teaches. The Memory Garden is a
 * field of upright RAM sticks; the Network Tower is a stack of routers; the
 * Storage Warehouse is a rack of drives.
 */

/* -------------------------------------------------------------------------- */
/* Computer Monument — the centrepiece of the plaza                            */
/* -------------------------------------------------------------------------- */

export function ComputerMonument() {
  const ring = useRef<Mesh>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state, delta) => {
    if (!ring.current || reducedMotion) return
    ring.current.rotation.z += delta * 0.25
    // Gentle vertical drift so it reads as "hovering".
    ring.current.position.y = 4.6 + Math.sin(state.clock.elapsedTime * 0.9) * 0.12
  })

  return (
    <group position={[0, 0, -12]}>
      {/* Plinth */}
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[2.6, 3.0, 0.5, 8]} />
        <meshStandardMaterial color="#5a6478" roughness={0.8} />
      </mesh>
      <mesh receiveShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[2.2, 2.6, 0.2, 8]} />
        <meshStandardMaterial color="#6d7891" roughness={0.7} />
      </mesh>

      {/* Giant stylised monitor */}
      <group position={[0, 2.6, 0]} rotation={[0, -0.25, 0]}>
        <mesh castShadow>
          <boxGeometry args={[4.2, 2.6, 0.4]} />
          <meshStandardMaterial color="#242c3d" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Screen — the village's "output" made physical */}
        <mesh position={[0, 0, -0.22]}>
          <boxGeometry args={[3.8, 2.2, 0.06]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.75}
            toneMapped={false}
          />
        </mesh>
        {/* Circuit trace pattern etched on the screen */}
        {[0.7, 0.2, -0.3, -0.8].map((y) => (
          <mesh key={y} position={[0, y, -0.26]}>
            <boxGeometry args={[3.0, 0.05, 0.02]} />
            <meshStandardMaterial
              color="#0b1220"
              emissive="#0b1220"
              emissiveIntensity={0.2}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Support column */}
      <mesh castShadow position={[0, 1.3, 0.3]}>
        <boxGeometry args={[0.6, 1.5, 0.6]} />
        <meshStandardMaterial color="#3a445a" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Hovering data ring */}
      <mesh ref={ring} position={[0, 4.6, 0]} rotation={[-Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[2.9, 0.09, 8, 48]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={1.3}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting data bits */}
      <OrbitingBits />
    </group>
  )
}

function OrbitingBits() {
  const group = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!group.current) return
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    group.current.rotation.y = t * 0.4
    group.current.children.forEach((child, index) => {
      child.position.y = Math.sin(t * 1.3 + index * 1.7) * 0.4
    })
  })

  return (
    <group ref={group} position={[0, 4.6, 0]}>
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(angle) * 3.4, 0, Math.sin(angle) * 3.4]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#38bdf8' : '#e879f9'}
              emissive={i % 2 === 0 ? '#38bdf8' : '#e879f9'}
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* The village computer — the quest subject                                    */
/* -------------------------------------------------------------------------- */

export interface VillageComputerProps {
  /** Drives the monitor glow and the tower's LEDs. */
  powered: boolean
  /** Shows a RAM stick inside the case once the player installs it. */
  ramInstalled: boolean
  /** Highlights the parts the current objective asks about (spec §21). */
  highlightedId: string | null
}

export function VillageComputer({
  powered,
  ramInstalled,
  highlightedId,
}: VillageComputerProps) {
  return (
    <group position={[-0.6, 0, -7.6]} rotation={[0, 0.3, 0]}>
      <Desk />
      <group position={[-1.5, 1.02, 0.1]}>
        <MonitorAssembly
          powered={powered}
          highlighted={highlightedId === 'village-computer-monitor'}
        />
      </group>
      <group position={[-0.7, 1.02, 1.36]}>
        <KeyboardAssembly
          highlighted={highlightedId === 'village-computer-keyboard'}
        />
      </group>
      <group position={[0.45, 1.02, 1.4]}>
        <MouseAssembly highlighted={highlightedId === 'village-computer-mouse'} />
      </group>
      <group position={[1.2, 0, -0.3]}>
        <TowerAssembly
          powered={powered}
          ramInstalled={ramInstalled}
          highlighted={highlightedId === 'village-computer-tower'}
        />
      </group>
    </group>
  )
}

function Desk() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.98, 0.5]}>
        <boxGeometry args={[4.4, 0.14, 2.2]} />
        <meshStandardMaterial color="#8a6f4a" roughness={0.8} />
      </mesh>
      {(
        [
          [-1.9, -0.3],
          [1.9, -0.3],
          [-1.9, 1.3],
          [1.9, 1.3],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.45, z]}>
          <boxGeometry args={[0.16, 0.9, 0.16]} />
          <meshStandardMaterial color="#5a4a33" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/** Local, desk-scale monitor. Distinct from the giant monument on purpose. */
function MonitorAssembly({
  powered,
  highlighted,
}: {
  powered: boolean
  highlighted: boolean
}) {
  const screenColor = powered ? '#7dd3fc' : '#0b1220'
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.1, 16]} />
        <meshStandardMaterial color="#222a3a" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#222a3a" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[1.35, 0.85, 0.08]} />
        <meshStandardMaterial
          color="#222a3a"
          roughness={0.5}
          emissive={highlighted ? '#38bdf8' : '#000000'}
          emissiveIntensity={highlighted ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, 0.85, -0.045]}>
        <boxGeometry args={[1.22, 0.72, 0.02]} />
        <meshStandardMaterial
          color={screenColor}
          emissive={screenColor}
          emissiveIntensity={powered ? 0.9 : 0.02}
          toneMapped={powered}
          roughness={0.25}
        />
      </mesh>
      {/* Static "no signal" bar, visible only when unpowered */}
      {!powered ? (
        <mesh position={[0, 0.85, -0.06]}>
          <boxGeometry args={[0.5, 0.05, 0.01]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} />
        </mesh>
      ) : null}
    </group>
  )
}

function KeyboardAssembly({ highlighted }: { highlighted: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.03, 0]}>
        <boxGeometry args={[1.1, 0.06, 0.4]} />
        <meshStandardMaterial
          color="#222a3a"
          roughness={0.6}
          emissive={highlighted ? '#38bdf8' : '#000000'}
          emissiveIntensity={highlighted ? 0.3 : 0}
        />
      </mesh>
      {Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 11 }, (_, col) => (
          <mesh key={`${row}-${col}`} position={[-0.45 + col * 0.09, 0.07, -0.12 + row * 0.09]}>
            <boxGeometry args={[0.07, 0.015, 0.07]} />
            <meshStandardMaterial color="#3a445a" roughness={0.75} />
          </mesh>
        )),
      )}
    </group>
  )
}

function MouseAssembly({ highlighted }: { highlighted: boolean }) {
  return (
    <mesh castShadow position={[0, 0.07, 0]}>
      <capsuleGeometry args={[0.1, 0.14, 4, 12]} />
      <meshStandardMaterial
        color="#222a3a"
        roughness={0.45}
        emissive={highlighted ? '#38bdf8' : '#000000'}
        emissiveIntensity={highlighted ? 0.35 : 0}
      />
    </mesh>
  )
}

/** The tower, with a case window that reveals the empty RAM slot. */
function TowerAssembly({
  powered,
  ramInstalled,
  highlighted,
}: {
  powered: boolean
  ramInstalled: boolean
  highlighted: boolean
}) {
  const leds = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!leds.current) return
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    leds.current.children.forEach((child, index) => {
      const mesh = child as Mesh
      const material = mesh.material as import('three').MeshStandardMaterial
      material.emissiveIntensity = powered ? 0.9 + Math.sin(t * 2 + index) * 0.3 : 0.02
    })
  })

  return (
    <group>
      {/* Case */}
      <mesh castShadow receiveShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[0.95, 1.7, 1.0]} />
        <meshStandardMaterial
          color="#242c3d"
          roughness={0.5}
          metalness={0.35}
          emissive={highlighted ? '#38bdf8' : '#000000'}
          emissiveIntensity={highlighted ? 0.22 : 0}
        />
      </mesh>

      {/* Side window, facing the player's approach */}
      <mesh position={[-0.48, 0.9, 0]}>
        <boxGeometry args={[0.02, 1.25, 0.72]} />
        <meshStandardMaterial
          color="#0d1526"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Motherboard plate inside */}
      <mesh position={[-0.26, 0.85, 0]}>
        <boxGeometry args={[0.35, 1.1, 0.72]} />
        <meshStandardMaterial color="#123f2c" roughness={0.7} />
      </mesh>

      {/* The two RAM slots. Slot 0 is empty until the player installs the
          module; this gap is the clue the entire quest rests on. */}
      {[0.14, -0.14].map((z, index) => (
        <group key={z} position={[-0.29, 1.05, z]}>
          <mesh>
            <boxGeometry args={[0.09, 0.44, 0.055]} />
            <meshStandardMaterial color="#1b2434" roughness={0.7} />
          </mesh>
          {index === 0 && ramInstalled ? (
            <group scale={0.28} rotation={[0, 0, Math.PI / 2]} position={[-0.04, 0, 0]}>
              <RamModule />
            </group>
          ) : null}
          {index === 0 && !ramInstalled ? (
            <mesh position={[-0.05, 0, 0]}>
              <boxGeometry args={[0.015, 0.38, 0.045]} />
              <meshStandardMaterial
                color="#0a0f18"
                emissive="#fbbf24"
                emissiveIntensity={0.4}
              />
            </mesh>
          ) : null}
        </group>
      ))}

      {/* Front panel */}
      <mesh position={[0, 0.85, 0.51]}>
        <boxGeometry args={[0.9, 1.6, 0.03]} />
        <meshStandardMaterial color="#1b2231" roughness={0.6} />
      </mesh>

      {/* Power button — glows cyan when the machine runs */}
      <mesh position={[0, 1.52, 0.53]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.04, 14]} />
        <meshStandardMaterial
          color={powered ? '#38bdf8' : '#39445c'}
          emissive={powered ? '#38bdf8' : '#000000'}
          emissiveIntensity={powered ? 1.8 : 0}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>

      <group ref={leds} position={[0.28, 1.3, 0.53]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, -i * 0.07, 0]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial
              color={['#38bdf8', '#fbbf24', '#e879f9'][i]}
              emissive={['#38bdf8', '#fbbf24', '#e879f9'][i]}
              emissiveIntensity={0.9}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Memory Garden — RAM as a planted field                                      */
/* -------------------------------------------------------------------------- */

export function MemoryGarden() {
  const sticks = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!sticks.current || reducedMotion) return
    const t = state.clock.elapsedTime
    sticks.current.children.forEach((child, index) => {
      child.position.y = 0.9 + Math.sin(t * 0.8 + index * 0.6) * 0.08
      child.rotation.y = Math.sin(t * 0.3 + index) * 0.15
    })
  })

  return (
    <group position={[14, 0, -14]}>
      {/* Soil bed */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[4.4, 4.6, 0.1, 24]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <torusGeometry args={[4.42, 0.09, 6, 32]} />
        <meshStandardMaterial color="#6d7891" roughness={0.7} />
      </mesh>

      {/* Upright RAM sticks, "planted" in rows */}
      <group ref={sticks}>
        {Array.from({ length: 9 }, (_, i) => {
          const angle = (i / 9) * Math.PI * 2
          const radius = 2.6
          return (
            <group
              key={i}
              position={[Math.cos(angle) * radius, 0.9, Math.sin(angle) * radius]}
              rotation={[0, -angle, 0]}
            >
              <group rotation={[0, 0, Math.PI / 2]} scale={0.8}>
                <RamModule highlighted />
              </group>
            </group>
          )
        })}
      </group>

      {/* A single central stick on a pedestal, brighter than the rest */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.5, 12]} />
        <meshStandardMaterial color="#5a6478" roughness={0.7} />
      </mesh>
      <group position={[0, 1.35, 0]} rotation={[0, 0.6, 0]}>
        <group rotation={[0, 0, Math.PI / 2]} scale={1.3}>
          <RamModule highlighted />
        </group>
      </group>

      <pointLight
        position={[0, 2.4, 0]}
        color="#38bdf8"
        intensity={6}
        distance={12}
        decay={2}
      />
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Network Tower — routers stacked into a tower                                */
/* -------------------------------------------------------------------------- */

export function NetworkTower() {
  const rings = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!rings.current || reducedMotion) return
    const t = state.clock.elapsedTime
    rings.current.rotation.y = t * 0.6
  })

  return (
    <group position={[19, 0, 2]}>
      {/* Base */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.3, 8]} />
        <meshStandardMaterial color="#4a5468" roughness={0.8} />
      </mesh>

      {/* Stacked routers at decreasing scale — a "tower" of network gear */}
      {[0, 1, 2, 3].map((level) => (
        <group
          key={level}
          position={[0, 1.2 + level * 1.5, 0]}
          rotation={[0, level * 0.4, 0]}
          scale={1 - level * 0.13}
        >
          <RouterProp />
        </group>
      ))}

      {/* Antenna mast */}
      <mesh position={[0, 8.2, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 3.4, 8]} />
        <meshStandardMaterial color="#4a5468" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 10, 0]}>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* Expanding signal rings */}
      <group ref={rings} position={[0, 10, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.2 + i * 0.9, 0.035, 6, 40]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={0.9}
              transparent
              opacity={0.55 - i * 0.12}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Storage Warehouse — a rack of drives                                        */
/* -------------------------------------------------------------------------- */

export function StorageWarehouse() {
  return (
    <group position={[0, 0, 20]}>
      {/* Open-sided rack, so the drives inside are visible from the path */}
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[10, 0.2, 8]} />
        <meshStandardMaterial color="#6b5a45" roughness={0.9} />
      </mesh>

      {[-3.4, 3.4].map((x) => (
        <mesh key={x} castShadow position={[x, 2.2, 0]}>
          <boxGeometry args={[0.3, 4.4, 7.4]} />
          <meshStandardMaterial color="#5a4a33" roughness={0.85} />
        </mesh>
      ))}

      {/* Shelves of drives */}
      {[0.9, 2.2, 3.5].map((y, shelf) => (
        <group key={y} position={[0, y, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[6.6, 0.14, 6.4]} />
            <meshStandardMaterial color="#7a6647" roughness={0.9} />
          </mesh>
          {[-2.2, -0.7, 0.8, 2.3].map((x, index) => (
            <group key={x} position={[x, 0.2, 0]} rotation={[0, (shelf + index) * 0.2, 0]}>
              {shelf % 2 === 0 ? (
                <group scale={1.5}>
                  <SsdSlot />
                </group>
              ) : (
                <group scale={1.4}>
                  <HddSlot />
                </group>
              )}
            </group>
          ))}
        </group>
      ))}

      <pointLight position={[0, 4.5, 0]} color="#fbbf24" intensity={5} distance={14} decay={2} />
    </group>
  )
}

function SsdSlot() {
  return <mesh castShadow><boxGeometry args={[0.9, 0.13, 0.65]} /><meshStandardMaterial color="#b6c2d6" roughness={0.3} metalness={0.7} /></mesh>
}

function HddSlot() {
  return <mesh castShadow><boxGeometry args={[1.0, 0.26, 0.72]} /><meshStandardMaterial color="#8f9bb3" roughness={0.35} metalness={0.6} /></mesh>
}

/* -------------------------------------------------------------------------- */
/* Hardware Lab gate — the reward the first quest unlocks                      */
/* -------------------------------------------------------------------------- */

export function LabGate({
  unlocked,
  position = [0, 0, -24],
  onApproach,
}: {
  unlocked: boolean
  /**
   * Where the gate stands. Defaults to its original spot in the grass; the
   * scene moves it flush against the lab's doorway now that the building has
   * one, so the gate frames the entrance instead of floating in front of it.
   */
  position?: [number, number, number]
  onApproach?: () => void
}) {
  const beams = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!beams.current || reducedMotion || unlocked) return
    const t = state.clock.elapsedTime
    beams.current.children.forEach((child, index) => {
      const mesh = child as Mesh
      const material = mesh.material as import('three').MeshStandardMaterial
      material.opacity = 0.25 + Math.sin(t * 2 + index * 1.6) * 0.12
    })
  })

  const beamColor = unlocked ? '#4ade80' : '#fbbf24'

  return (
    <group position={position} onPointerEnter={onApproach}>
      {/* Posts */}
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow position={[0, 1.9, 0]}>
            <boxGeometry args={[0.45, 3.8, 0.45]} />
            <meshStandardMaterial color="#3a445a" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 3.9, 0]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial
              color={beamColor}
              emissive={beamColor}
              emissiveIntensity={1.6}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Arch */}
      <mesh castShadow position={[0, 4.0, 0]}>
        <boxGeometry args={[6.1, 0.5, 0.5]} />
        <meshStandardMaterial color="#3a445a" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Energy field — solid green once unlocked, pulsing amber while locked */}
      <group ref={beams}>
        <mesh position={[0, 1.9, 0]}>
          <planeGeometry args={[4.9, 3.6]} />
          <meshStandardMaterial
            color={beamColor}
            emissive={beamColor}
            emissiveIntensity={0.7}
            transparent
            opacity={unlocked ? 0.12 : 0.3}
            side={2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Sign */}
      <group position={[0, 4.9, 0]}>
        <mesh>
          <planeGeometry args={[4.4, 0.9]} />
          <meshStandardMaterial color="#1c2740" roughness={0.6} side={2} />
        </mesh>
      </group>
    </group>
  )
}
