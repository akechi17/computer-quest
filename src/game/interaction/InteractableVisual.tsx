import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import {
  Billboard,
  Html,
} from '@react-three/drei'
import type { Group, Mesh } from 'three'
import type { InteractiveDefinition } from '@/data/types'
import { useInteractionStore } from './interactionStore'
import { useReducedMotion } from '@/game/core/useReducedMotion'

/**
 * The visual language for interactive objects (spec §21).
 *
 * An interactable communicates three things, in this order:
 *   1. That it exists and is interesting — a slow bob and a floating icon.
 *   2. That it is *current* — a brighter icon and a ground ring, for the one
 *      object the active objective points at.
 *   3. That it is *usable right now* — the icon lifts and the label appears
 *      when the player is close enough.
 *
 * Crucially, none of these rely on colour alone: shape, motion, and text all
 * carry the signal too.
 */

export interface InteractableVisualProps {
  definition: InteractiveDefinition
  /** True when this is the object the current quest objective points at. */
  isObjectiveTarget?: boolean
  children: React.ReactNode
}

export function InteractableVisual({
  definition,
  isObjectiveTarget = false,
  children,
}: InteractableVisualProps) {
  const group = useRef<Group>(null)
  const iconGroup = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const reducedMotion = useReducedMotion()

  const isNearest = useInteractionStore((s) => s.nearest?.id === definition.id)
  useCursor(isNearest)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // The object itself bobs very gently; the icon bobs more, so the two never
    // read as one rigid unit.
    if (group.current && !reducedMotion) {
      group.current.position.y = Math.sin(t * 0.9) * 0.05
    }

    if (iconGroup.current) {
      const targetY = isNearest ? 1.5 : 1.25
      const bob = reducedMotion ? 0 : Math.sin(t * 1.8) * 0.08
      iconGroup.current.position.y +=
        (targetY + bob - iconGroup.current.position.y) * Math.min(delta * 8, 1)
      // Fade the icon up when the player is close.
      const targetScale = isNearest ? 1.25 : isObjectiveTarget ? 1.05 : 0.85
      const s = iconGroup.current.scale.x
      const next = s + (targetScale - s) * Math.min(delta * 6, 1)
      iconGroup.current.scale.setScalar(next)
    }

    // The pulse ring only shows for the current objective, and only spins when
    // motion is allowed.
    if (ring.current) {
      if (!reducedMotion) ring.current.rotation.z += delta * 0.6
      const material = ring.current.material as import('three').MeshBasicMaterial
      material.opacity = reducedMotion
        ? 0.5
        : 0.35 + Math.sin(t * 2.4) * 0.15
    }
  })

  const iconColor = isNearest
    ? '#7dd3fc'
    : isObjectiveTarget
      ? '#fbbf24'
      : '#94a3b8'

  return (
    <group
      ref={group}
      position={[definition.position[0], definition.position[1], definition.position[2]]}
      rotation={[0, definition.rotationY ?? 0, 0]}
    >
      {children}

      {/* Floating icon. Kept as a billboard so it always faces the camera,
          and hidden from the scene graph's lighting so it reads as UI. */}
      <group ref={iconGroup} position={[0, 1.25, 0]}>
        <Billboard>
          <mesh>
            <circleGeometry args={[0.3, 24]} />
            <meshBasicMaterial
              color="#0b1220"
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.29, 0.33, 24]} />
            <meshBasicMaterial
              color={iconColor}
              transparent
              opacity={0.9}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <Html
            center
            distanceFactor={9}
            zIndexRange={[20, 0]}
            style={{
              fontSize: '20px',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
              filter: isNearest ? 'drop-shadow(0 0 6px rgba(125,211,252,0.9))' : 'none',
            }}
          >
            <span aria-hidden="true">{definition.icon}</span>
          </Html>
        </Billboard>

        {/* Name label, shown only when the object is the active candidate. */}
        {isNearest ? (
          <Html
            center
            position={[0, -0.55, 0]}
            distanceFactor={12}
            zIndexRange={[19, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div className="cq-pop whitespace-nowrap rounded-full bg-cq-night/80 px-3 py-1 text-xs font-semibold text-cq-ink backdrop-blur-sm">
              {definition.label}
            </div>
          </Html>
        ) : null}
      </group>

      {/* Objective ring on the ground — a shape signal, not a colour signal. */}
      {isObjectiveTarget ? (
        <>
          <mesh
            ref={ring}
            position={[0, 0.04, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.85, 1.0, 32]} />
            <meshBasicMaterial
              color="#fbbf24"
              transparent
              opacity={0.45}
              side={2}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* A vertical beacon, so the target is findable from across the
              village without a cluttered minimap. */}
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.06, 0.02, 4.4, 8, 1, true]} />
            <meshBasicMaterial
              color="#fbbf24"
              transparent
              opacity={0.14}
              side={2}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </>
      ) : null}
    </group>
  )
}
