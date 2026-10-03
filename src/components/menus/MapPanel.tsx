import { useEffect, useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useProgressStore } from '@/stores/progressStore'
import { INTERACTIVES, LOCATIONS } from '@/data/world'
import { ZONE_LIST } from '@/data/zones'
import { WORLD } from '@/utils/constants'
import { playerTransform } from '@/game/core/playerTransform'
import { useReducedMotion } from '@/game/core/useReducedMotion'

/**
 * Stylised world map (spec §26).
 *
 * Deliberately simple: a square, a few labelled pins, locked zones greyed out,
 * and the player's live position. It is drawn with SVG rather than a canvas
 * because the content is a handful of static points — a texture would be
 * overkill and would need regenerating whenever the world changed.
 *
 * The player dot is polled on a slow interval rather than every frame: an open
 * map is not a twitch game, and this keeps it off the render hot path.
 */

/** The world is 90 units across; the map is drawn at this pixel size. */
const MAP_SIZE = 320
const POLL_MS = 120

export function MapPanel() {
  const overlay = useSessionStore((s) => s.overlay)
  const closeOverlay = useSessionStore((s) => s.closeOverlay)
  const unlockedZoneIds = useProgressStore((s) => s.unlockedZoneIds)
  const reducedMotion = useReducedMotion()

  const [player, setPlayer] = useState({ x: 0, z: 0, heading: 0 })

  useEffect(() => {
    if (overlay !== 'map') return
    const interval = window.setInterval(() => {
      setPlayer({
        x: playerTransform.position.x,
        z: playerTransform.position.z,
        heading: playerTransform.heading,
      })
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [overlay])

  useEffect(() => {
    if (overlay !== 'map') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        closeOverlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [overlay, closeOverlay])

  if (overlay !== 'map') return null

  /* World coordinates → map pixels. North (-Z) is up. */
  const toMap = (x: number, z: number) => ({
    cx: ((x + WORLD.SIZE / 2) / WORLD.SIZE) * MAP_SIZE,
    cy: ((z + WORLD.SIZE / 2) / WORLD.SIZE) * MAP_SIZE,
  })

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cq-night/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Map of Computer Village"
        className="cq-panel-solid cq-pop flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-cq-edge/60 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-black text-cq-ink">Map</h2>
            <p className="text-[0.72rem] text-cq-muted">Computer Village</p>
          </div>
          <button
            type="button"
            onClick={closeOverlay}
            className="cq-button cq-button-ghost !px-3 !py-1.5 text-[0.78rem]"
          >
            Close
          </button>
        </div>

        <div className="flex justify-center p-4">
          <svg
            viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
            className="w-full max-w-[320px] rounded-xl border border-cq-edge/50 bg-cq-deep"
            role="img"
            aria-label="Top-down map showing the player, points of interest and zone gates"
          >
            {/* Plaza */}
            <circle
              cx={MAP_SIZE / 2}
              cy={MAP_SIZE / 2}
              r={MAP_SIZE * 0.14}
              fill="#4f8f5e"
              opacity={0.55}
            />

            {/* Paths, mirroring the authored layout */}
            <g stroke="#c2a878" strokeWidth={5} strokeLinecap="round" opacity={0.7}>
              <line
                x1={MAP_SIZE / 2}
                y1={MAP_SIZE / 2}
                x2={MAP_SIZE / 2}
                y2={toMap(0, -24).cy}
              />
              <line
                x1={MAP_SIZE / 2}
                y1={MAP_SIZE / 2}
                x2={MAP_SIZE / 2}
                y2={toMap(0, 20).cy}
              />
              <line
                x1={MAP_SIZE / 2}
                y1={MAP_SIZE / 2}
                x2={toMap(19, 2).cx}
                y2={MAP_SIZE / 2}
              />
              <line
                x1={MAP_SIZE / 2}
                y1={MAP_SIZE / 2}
                x2={toMap(-18, 4).cx}
                y2={toMap(0, 4).cy}
              />
            </g>

            {/* Zone gates */}
            {ZONE_LIST.map((zone) => {
              const { cx, cy } = toMap(zone.anchor[0], zone.anchor[2])
              const unlocked = unlockedZoneIds.includes(zone.id)
              return (
                <g key={zone.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8}
                    fill={unlocked ? '#38bdf8' : '#1c2740'}
                    stroke={unlocked ? '#7dd3fc' : '#4b5563'}
                    strokeWidth={2}
                  />
                  {/* A slash marks a locked zone — a shape signal, not colour. */}
                  {!unlocked ? (
                    <line
                      x1={cx - 5}
                      y1={cy + 5}
                      x2={cx + 5}
                      y2={cy - 5}
                      stroke="#94a3b8"
                      strokeWidth={2}
                    />
                  ) : null}
                  <text
                    x={cx}
                    y={cy + 20}
                    textAnchor="middle"
                    fontSize={8}
                    fill={unlocked ? '#f2f6ff' : '#7b8798'}
                    fontWeight={700}
                  >
                    {zone.name.split(' ')[0]}
                  </text>
                </g>
              )
            })}

            {/* Points of interest */}
            {Object.values(INTERACTIVES)
              .filter((item) => item.kind !== 'gate')
              .map((item) => {
                const { cx, cy } = toMap(item.position[0], item.position[2])
                const isLandmark = item.position[0] !== 0 || item.position[2] !== 0
                if (!isLandmark) return null
                return (
                  <circle
                    key={item.id}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="#fbbf24"
                    opacity={0.85}
                  />
                )
              })}

            {/* Named locations */}
            {Object.values(LOCATIONS).map((location) => {
              const { cx, cy } = toMap(location.position[0], location.position[2])
              return (
                <text
                  key={location.id}
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#a3b2d1"
                >
                  {location.label}
                </text>
              )
            })}

            {/* The player. Rotated triangle so facing is visible. */}
            <g
              transform={`translate(${toMap(player.x, player.z).cx} ${toMap(player.x, player.z).cy}) rotate(${(-player.heading * 180) / Math.PI})`}
            >
              <circle r={9} fill="#38bdf8" opacity={reducedMotion ? 0.25 : 0.2} />
              <polygon points="0,-7 5,6 0,3 -5,6" fill="#7dd3fc" />
            </g>
          </svg>
        </div>

        <div className="border-t border-cq-edge/60 px-5 py-3">
          <ul className="space-y-1.5">
            {ZONE_LIST.map((zone) => {
              const unlocked = unlockedZoneIds.includes(zone.id)
              return (
                <li
                  key={zone.id}
                  className="flex items-start gap-2 text-[0.75rem]"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black',
                      unlocked
                        ? 'bg-cq-accent text-cq-night'
                        : 'border border-cq-edge text-cq-muted',
                    ].join(' ')}
                  >
                    {unlocked ? '✓' : '🔒'}
                  </span>
                  <span className={unlocked ? 'text-cq-ink' : 'text-cq-muted'}>
                    {zone.name}
                    <span className="block text-[0.68rem] leading-snug text-cq-muted">
                      {zone.description}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
