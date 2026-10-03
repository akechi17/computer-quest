import { useMemo } from 'react'
import { Color } from 'three'
import { RENDER, WORLD } from '@/utils/constants'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * Scene lighting.
 *
 * Performance stance (spec §29): exactly ONE shadow-casting light, with a
 * tight shadow camera fitted to the playable area rather than the whole world.
 * Everything else is ambient or unlit-by-design. Shadows are the first thing
 * to drop when the player picks the "low" quality preset.
 */
export function GameLighting() {
  const quality = useSettingsStore((s) => s.quality)
  const shadowsEnabled = quality !== 'low'
  const shadowMapSize = quality === 'high' ? 2048 : RENDER.SHADOW_MAP_SIZE

  /* Fog and background share a tint so the horizon reads as one surface. */
  const fogColor = useMemo(() => new Color('#a8d5ec'), [])

  return (
    <>
      <fog attach="fog" args={[fogColor, RENDER.FOG_NEAR, RENDER.FOG_FAR]} />
      <color attach="background" args={['#8ec9e8']} />

      {/* Sky/ground bounce. Cheap and does most of the ambient work. */}
      <hemisphereLight
        args={['#cfe9ff', '#5a7a4a', 1.15]}
        position={[0, 40, 0]}
      />

      {/* The sun. Positioned so the plaza and monument get long, readable
          shadows without any surface being fully backlit. */}
      <directionalLight
        position={[26, 38, 18]}
        intensity={1.9}
        color="#fff6e0"
        castShadow={shadowsEnabled}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-WORLD.SIZE / 2}
        shadow-camera-right={WORLD.SIZE / 2}
        shadow-camera-top={WORLD.SIZE / 2}
        shadow-camera-bottom={-WORLD.SIZE / 2}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />

      {/* A soft fill from the opposite side so interiors are not black. No
          shadow, so it costs almost nothing. */}
      <directionalLight position={[-18, 14, -22]} intensity={0.35} color="#bcd8ff" />

      {/* Warm accent near the plaza, echoing the monument's glow. */}
      <pointLight
        position={[0, 6, -12]}
        color="#38bdf8"
        intensity={8}
        distance={22}
        decay={2}
      />
    </>
  )
}
