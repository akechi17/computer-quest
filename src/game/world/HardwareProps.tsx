import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useReducedMotion } from '@/game/core/useReducedMotion'

/**
 * Stylised hardware models, built from primitives.
 *
 * Spec §20: hardware must be *recognisable* and the components must not all
 * look alike — so each one is built around its real-world silhouette. A RAM
 * stick is long and thin with gold contacts; a CPU is a flat square with a
 * heat spreader and a notch; an SSD is a flat brick with a label. Colours are
 * exaggerated but the shapes are honest.
 */

interface PropProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  /** Interactive props get a subtle emissive lift (spec §21). */
  highlighted?: boolean
}

const PALETTE = {
  pcbGreen: '#1f6f4a',
  pcbDark: '#123f2c',
  gold: '#e0b040',
  chipBlack: '#181c26',
  heatsink: '#9aa6bd',
  metal: '#b6c2d6',
  plasticDark: '#222a3a',
  plasticLight: '#dde5f2',
  accentCyan: '#38bdf8',
  accentMagenta: '#e879f9',
  accentAmber: '#fbbf24',
  contact: '#d9a441',
} as const

/* -------------------------------------------------------------------------- */
/* RAM                                                                         */
/* -------------------------------------------------------------------------- */

export function RamModule({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* PCB */}
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.34, 0.06]} />
        <meshStandardMaterial
          color={PALETTE.pcbGreen}
          roughness={0.6}
          emissive={highlighted ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={highlighted ? 0.22 : 0}
        />
      </mesh>

      {/* Heatsink fins across the top edge */}
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
        <mesh key={x} castShadow position={[x, 0.02, 0]}>
          <boxGeometry args={[0.18, 0.4, 0.1]} />
          <meshStandardMaterial
            color={PALETTE.heatsink}
            roughness={0.35}
            metalness={0.65}
          />
        </mesh>
      ))}

      {/* Memory chips along the bottom */}
      {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
        <mesh key={x} position={[x, -0.06, -0.04]}>
          <boxGeometry args={[0.2, 0.12, 0.02]} />
          <meshStandardMaterial color={PALETTE.chipBlack} roughness={0.7} />
        </mesh>
      ))}

      {/* Gold contact fingers — the detail that makes it unmistakably RAM */}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[-0.63 + i * 0.097, -0.19, 0]}>
          <boxGeometry args={[0.05, 0.06, 0.062]} />
          <meshStandardMaterial
            color={PALETTE.contact}
            roughness={0.3}
            metalness={0.9}
          />
        </mesh>
      ))}

      {/* Notch */}
      <mesh position={[0.17, -0.19, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.065]} />
        <meshStandardMaterial color={PALETTE.pcbDark} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* CPU                                                                         */
/* -------------------------------------------------------------------------- */

export function CpuChip({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Substrate */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.09, 0.9]} />
        <meshStandardMaterial color={PALETTE.pcbDark} roughness={0.6} />
      </mesh>
      {/* Integrated heat spreader */}
      <mesh castShadow position={[0, 0.07, 0]}>
        <boxGeometry args={[0.72, 0.07, 0.72]} />
        <meshStandardMaterial
          color={PALETTE.heatsink}
          roughness={0.25}
          metalness={0.85}
          emissive={highlighted ? PALETTE.accentAmber : '#000000'}
          emissiveIntensity={highlighted ? 0.2 : 0}
        />
      </mesh>
      {/* Engraved marking */}
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[0.34, 0.005, 0.34]} />
        <meshStandardMaterial color="#6b7791" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Gold triangle marking the pin-1 corner — a real CPU detail */}
      <mesh position={[-0.32, 0.075, -0.32]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.05, 3]} />
        <meshStandardMaterial color={PALETTE.contact} metalness={0.95} roughness={0.25} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* GPU                                                                         */
/* -------------------------------------------------------------------------- */

export function GpuCard({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  const fan = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((_, delta) => {
    if (fan.current && !reducedMotion) fan.current.rotation.z += delta * 6
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Shroud */}
      <mesh castShadow>
        <boxGeometry args={[1.9, 0.85, 0.34]} />
        <meshStandardMaterial
          color={PALETTE.plasticDark}
          roughness={0.55}
          emissive={highlighted ? PALETTE.accentMagenta : '#000000'}
          emissiveIntensity={highlighted ? 0.2 : 0}
        />
      </mesh>
      {/* PCB edge peeking out the bottom */}
      <mesh position={[0, -0.46, 0]}>
        <boxGeometry args={[1.9, 0.1, 0.32]} />
        <meshStandardMaterial color={PALETTE.pcbGreen} roughness={0.6} />
      </mesh>
      {/* PCIe contacts */}
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[-0.85 + i * 0.1, -0.5, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.3]} />
          <meshStandardMaterial color={PALETTE.contact} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* Twin fans */}
      {[-0.45, 0.45].map((x) => (
        <group key={x} position={[x, 0.03, -0.18]}>
          <mesh>
            <torusGeometry args={[0.28, 0.06, 8, 20]} />
            <meshStandardMaterial color="#0e1420" roughness={0.6} />
          </mesh>
          <group ref={x === -0.45 ? fan : undefined} position={[0, 0, 0.01]}>
            {[0, 1, 2, 3, 4, 5].map((blade) => (
              <mesh
                key={blade}
                rotation={[0, 0, (blade * Math.PI) / 3]}
                position={[0, 0, 0]}
              >
                <boxGeometry args={[0.22, 0.07, 0.015]} />
                <meshStandardMaterial
                  color={PALETTE.plasticLight}
                  roughness={0.5}
                  transparent
                  opacity={0.85}
                />
              </mesh>
            ))}
          </group>
        </group>
      ))}
      {/* Status light strip */}
      <mesh position={[0, 0.44, -0.1]}>
        <boxGeometry args={[0.7, 0.03, 0.03]} />
        <meshStandardMaterial
          color={PALETTE.accentMagenta}
          emissive={PALETTE.accentMagenta}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

export function SsdDrive({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.14, 0.7]} />
        <meshStandardMaterial
          color={PALETTE.metal}
          roughness={0.3}
          metalness={0.7}
          emissive={highlighted ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={highlighted ? 0.2 : 0}
        />
      </mesh>
      {/* Label plate */}
      <mesh position={[0, 0.075, 0]}>
        <boxGeometry args={[0.8, 0.01, 0.5]} />
        <meshStandardMaterial color="#2b3b57" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.082, 0.12]}>
        <boxGeometry args={[0.5, 0.005, 0.1]} />
        <meshStandardMaterial
          color={PALETTE.accentCyan}
          emissive={PALETTE.accentCyan}
          emissiveIntensity={0.7}
        />
      </mesh>
    </group>
  )
}

export function HddDrive({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* HDDs are visibly chunkier than SSDs — that difference is the lesson */}
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.26, 0.72]} />
        <meshStandardMaterial color="#8f9bb3" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Platter hub, visible through the top */}
      <mesh position={[0.12, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 24]} />
        <meshStandardMaterial color="#4a5468" roughness={0.25} metalness={0.9} />
      </mesh>
      <mesh position={[0.12, 0.155, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
        <meshStandardMaterial color={PALETTE.metal} roughness={0.2} metalness={0.95} />
      </mesh>
      {/* Actuator arm */}
      <mesh position={[-0.22, 0.15, 0.16]} rotation={[0, 0.7, 0]}>
        <boxGeometry args={[0.34, 0.02, 0.05]} />
        <meshStandardMaterial color="#39445c" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Motherboard / PSU / Cooler                                                  */
/* -------------------------------------------------------------------------- */

export function Motherboard({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.06, 1.6]} />
        <meshStandardMaterial
          color={PALETTE.pcbDark}
          roughness={0.65}
          emissive={highlighted ? PALETTE.pcbGreen : '#000000'}
          emissiveIntensity={highlighted ? 0.25 : 0}
        />
      </mesh>
      {/* CPU socket */}
      <mesh position={[-0.3, 0.045, -0.25]}>
        <boxGeometry args={[0.55, 0.05, 0.55]} />
        <meshStandardMaterial color="#2a3446" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* RAM slots */}
      {[0.25, 0.5, 0.75].map((z) => (
        <mesh key={z} position={[0.35, 0.045, z - 0.4]}>
          <boxGeometry args={[1.0, 0.05, 0.07]} />
          <meshStandardMaterial color={PALETTE.accentCyan} roughness={0.5} />
        </mesh>
      ))}
      {/* Chipset heatsink */}
      <mesh position={[0.4, 0.08, 0.42]}>
        <boxGeometry args={[0.45, 0.1, 0.45]} />
        <meshStandardMaterial color={PALETTE.heatsink} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Traces — the visual signature of a motherboard */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh
          key={i}
          position={[-0.7 + i * 0.18, 0.035, 0.7]}
          rotation={[0, 0, 0]}
        >
          <boxGeometry args={[0.02, 0.01, 1.1]} />
          <meshStandardMaterial
            color={PALETTE.contact}
            roughness={0.4}
            metalness={0.8}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  )
}

export function PowerSupply({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: PropProps) {
  const fan = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((_, delta) => {
    if (fan.current && !reducedMotion) fan.current.rotation.z += delta * 3
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.8, 1.0]} />
        <meshStandardMaterial color="#2c3444" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Fan grille */}
      <group position={[0, 0.05, -0.51]}>
        <mesh>
          <torusGeometry args={[0.3, 0.035, 8, 24]} />
          <meshStandardMaterial color="#4a5468" roughness={0.5} metalness={0.6} />
        </mesh>
        <group ref={fan}>
          {[0, 1, 2, 3, 4, 5, 6].map((blade) => (
            <mesh key={blade} rotation={[0, 0, (blade * Math.PI) / 3.5]}>
              <boxGeometry args={[0.26, 0.08, 0.012]} />
              <meshStandardMaterial color="#59637a" roughness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Cable bundle */}
      <mesh position={[0, -0.5, 0.3]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.5, 10]} />
        <meshStandardMaterial color="#151a26" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function CpuCooler({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: PropProps) {
  const fan = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((_, delta) => {
    if (fan.current && !reducedMotion) fan.current.rotation.y += delta * 5
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Fin stack */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0, i * 0.07, 0]} castShadow>
          <boxGeometry args={[0.7, 0.015, 0.5]} />
          <meshStandardMaterial color={PALETTE.heatsink} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {/* Heat pipes */}
      {[-0.2, 0, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.42, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 10]} />
          <meshStandardMaterial color={PALETTE.contact} roughness={0.25} metalness={0.95} />
        </mesh>
      ))}
      {/* Fan on top */}
      <group ref={fan} position={[0, 0.92, 0]}>
        {[0, 1, 2, 3, 4, 5, 6].map((blade) => (
          <mesh key={blade} rotation={[0, (blade * Math.PI) / 3.5, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 0.012, 0.08]} />
            <meshStandardMaterial color="#3a445a" roughness={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 1.0, 0]}>
        <torusGeometry args={[0.26, 0.03, 8, 20]} />
        <meshStandardMaterial color="#4a5468" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Peripherals                                                                 */
/* -------------------------------------------------------------------------- */

export function MonitorProp({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  /** When true the screen glows; when false it is dark. */
  powered = true,
  highlighted = false,
}: PropProps & { powered?: boolean }) {
  const screenColor = powered ? '#7dd3fc' : '#0b1220'

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Stand */}
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.3, 0.36, 0.12, 20]} />
        <meshStandardMaterial color={PALETTE.plasticDark} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[0.1, 0.66, 0.1]} />
        <meshStandardMaterial color={PALETTE.plasticDark} roughness={0.6} />
      </mesh>
      {/* Bezel */}
      <mesh castShadow position={[0, 0.95, 0]}>
        <boxGeometry args={[1.7, 1.0, 0.09]} />
        <meshStandardMaterial
          color={PALETTE.plasticDark}
          roughness={0.5}
          emissive={highlighted ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={highlighted ? 0.15 : 0}
        />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.95, -0.05]}>
        <boxGeometry args={[1.55, 0.86, 0.02]} />
        <meshStandardMaterial
          color={screenColor}
          emissive={screenColor}
          emissiveIntensity={powered ? 0.9 : 0.02}
          toneMapped={powered}
          roughness={0.25}
        />
      </mesh>
      {/* Power LED */}
      <mesh position={[0.72, 0.5, -0.055]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial
          color={powered ? PALETTE.accentCyan : '#4b5563'}
          emissive={powered ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={powered ? 2 : 0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export function KeyboardProp({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  const keys = useMemo(() => {
    const layout: Array<[number, number]> = []
    for (let row = 0; row < 4; row += 1) {
      const count = row === 3 ? 8 : 13
      for (let col = 0; col < count; col += 1) {
        const offset = row === 3 ? (13 - count) / 2 : 0
        layout.push([col + offset, row])
      }
    }
    return layout
  }, [])

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[1.4, 0.07, 0.5]} />
        <meshStandardMaterial
          color={PALETTE.plasticDark}
          roughness={0.6}
          emissive={highlighted ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={highlighted ? 0.15 : 0}
        />
      </mesh>
      {keys.map(([col, row]) => (
        <mesh key={`${col}-${row}`} position={[-0.6 + col * 0.095, 0.045, -0.16 + row * 0.1]}>
          <boxGeometry args={[0.075, 0.02, 0.08]} />
          <meshStandardMaterial color="#3a445a" roughness={0.75} />
        </mesh>
      ))}
      {/* Spacebar */}
      <mesh position={[0, 0.045, 0.14]}>
        <boxGeometry args={[0.6, 0.02, 0.08]} />
        <meshStandardMaterial color="#3a445a" roughness={0.75} />
      </mesh>
    </group>
  )
}

export function MouseProp({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
}: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh castShadow position={[0, 0.08, 0]}>
        <capsuleGeometry args={[0.13, 0.18, 4, 14]} />
        <meshStandardMaterial
          color={PALETTE.plasticDark}
          roughness={0.45}
          emissive={highlighted ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={highlighted ? 0.2 : 0}
        />
      </mesh>
      {/* Scroll wheel */}
      <mesh position={[0, 0.2, -0.06]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.04, 10]} />
        <meshStandardMaterial color={PALETTE.accentCyan} emissive={PALETTE.accentCyan} emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Computer tower                                                              */
/* -------------------------------------------------------------------------- */

export function TowerProp({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  highlighted = false,
  /** When false, the case shows an empty RAM slot — the quest's core clue. */
  ramInstalled = false,
}: PropProps & { ramInstalled?: boolean }) {
  const led = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (!led.current) return
    // A slow pulse reads as "powered on".
    led.current.children.forEach((child, i) => {
      const mesh = child as import('three').Mesh
      const material = mesh.material as import('three').MeshStandardMaterial
      const speed = reducedMotion ? 0 : 2 + i * 0.6
      material.emissiveIntensity =
        led.current?.visible === false
          ? 0
          : 0.7 + Math.sin(state.clock.elapsedTime * speed + i) * 0.3
    })
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Chassis */}
      <mesh castShadow position={[0, 1.0, 0]}>
        <boxGeometry args={[1.05, 2.0, 1.15]} />
        <meshStandardMaterial
          color="#242c3d"
          roughness={0.5}
          metalness={0.35}
          emissive={highlighted ? PALETTE.accentCyan : '#000000'}
          emissiveIntensity={highlighted ? 0.12 : 0}
        />
      </mesh>

      {/* Side window */}
      <mesh position={[-0.53, 1.05, 0]}>
        <boxGeometry args={[0.02, 1.5, 0.85]} />
        <meshStandardMaterial
          color="#0d1526"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Interior: motherboard plate */}
      <mesh position={[-0.3, 0.95, 0]}>
        <boxGeometry args={[0.4, 1.3, 0.85]} />
        <meshStandardMaterial color={PALETTE.pcbDark} roughness={0.7} />
      </mesh>

      {/* RAM slots. Installed shows a stick; empty shows the gap the player
          must notice. This is the visual clue the whole quest hangs on. */}
      {[0.15, -0.15].map((z, index) => (
        <group key={z} position={[-0.32, 1.15, z]}>
          <mesh>
            <boxGeometry args={[0.1, 0.5, 0.06]} />
            <meshStandardMaterial color="#1b2434" roughness={0.7} />
          </mesh>
          {index === 0 && ramInstalled ? (
            <group position={[-0.05, 0, 0]} scale={0.32} rotation={[0, 0, Math.PI / 2]}>
              <RamModule highlighted={false} />
            </group>
          ) : null}
          {index === 0 && !ramInstalled ? (
            // A dark cavity with a faint highlight so it is noticeable but not
            // garish — spec §21 says do not rely on colour alone.
            <mesh position={[-0.06, 0, 0]}>
              <boxGeometry args={[0.02, 0.44, 0.05]} />
              <meshStandardMaterial
                color="#0a0f18"
                emissive={PALETTE.accentAmber}
                emissiveIntensity={0.35}
              />
            </mesh>
          ) : null}
        </group>
      ))}

      {/* Front panel */}
      <mesh position={[0, 1.0, 0.59]}>
        <boxGeometry args={[1.0, 1.9, 0.03]} />
        <meshStandardMaterial color="#1b2231" roughness={0.6} />
      </mesh>

      {/* Power button */}
      <mesh position={[0, 1.78, 0.61]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.04, 16]} />
        <meshStandardMaterial color="#39445c" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Status LEDs */}
      <group ref={led} position={[0.3, 1.5, 0.61]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, -i * 0.08, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial
              color={
                [PALETTE.accentCyan, PALETTE.accentAmber, PALETTE.accentMagenta][i]
              }
              emissive={
                [PALETTE.accentCyan, PALETTE.accentAmber, PALETTE.accentMagenta][i]
              }
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Router — used by the Network Tower                                          */
/* -------------------------------------------------------------------------- */

export function RouterProp({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: PropProps) {
  const antennas = useRef<Group>(null)

  useFrame((state) => {
    if (!antennas.current) return
    antennas.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.22, 0.6]} />
        <meshStandardMaterial color="#2b3446" roughness={0.55} />
      </mesh>
      <group ref={antennas}>
        {[-0.3, 0, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.3, -0.2]} rotation={[0.25, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
            <meshStandardMaterial color="#4a5468" roughness={0.5} />
          </mesh>
        ))}
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.25 + i * 0.25, 0.12, 0.3]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial
            color={PALETTE.accentCyan}
            emissive={PALETTE.accentCyan}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export { PALETTE as HARDWARE_PALETTE }
