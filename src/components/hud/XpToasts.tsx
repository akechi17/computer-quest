import { useEffect, useRef, useState } from 'react'
import { questEvents } from '@/game/quests/questEvents'
import { BADGES } from '@/data/badges'
import { useProgressStore } from '@/stores/progressStore'

/**
 * Transient notifications: items found, quest completions, badges earned.
 *
 * Driven by the quest event bus and a store subscription rather than props, so
 * any system that awards something gets feedback for free without threading
 * callbacks up into the HUD.
 */

interface Toast {
  id: number
  icon: string
  title: string
  detail?: string
  tone: 'xp' | 'badge' | 'quest'
}

const TOAST_LIFETIME_MS = 3400
/** Beyond this the stack would cover the world, so the oldest drop off. */
const MAX_VISIBLE = 4

let nextToastId = 0

export function XpToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  /* A ref, not state: `push` is called from subscriptions and must not cause
     the effect that created them to re-run. */
  const pushRef = useRef<(toast: Omit<Toast, 'id'>) => void>(() => {})

  pushRef.current = (toast) => {
    const id = nextToastId++
    setToasts((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE))
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id))
    }, TOAST_LIFETIME_MS)
  }

  /* Gameplay events. */
  useEffect(() => {
    return questEvents.subscribe((event) => {
      const push = pushRef.current

      switch (event.type) {
        case 'item-collected':
          push({ icon: '📦', title: `Found: ${event.itemName}`, tone: 'quest' })
          break

        case 'quest-completed':
          push({
            icon: '🏆',
            title: 'Quest complete!',
            detail: 'Rewards added to your profile',
            tone: 'quest',
          })
          break

        case 'minigame-finished':
          if (event.success) {
            push({ icon: '🎮', title: 'Practice complete!', tone: 'xp' })
          }
          break

        case 'interaction-refused':
          // An object that needs something the player has not found yet. It
          // must say so, otherwise the object reads as broken rather than
          // locked — and a child will simply walk away.
          push({ icon: '❓', title: 'Nothing happens', detail: event.reason, tone: 'quest' })
          break

        case 'gate-locked':
          push({
            icon: '🔒',
            title: 'Locked',
            detail: 'Finish the quest to open this area',
            tone: 'quest',
          })
          break

        default:
          break
      }
    })
  }, [])

  /* Badges are awarded by mutating the store directly, so watch the store
     rather than the event bus. Zustand's vanilla subscribe keeps this off the
     React render path entirely. */
  useEffect(() => {
    let previous = new Set(useProgressStore.getState().badges)

    return useProgressStore.subscribe((state) => {
      for (const badgeId of state.badges) {
        if (previous.has(badgeId)) continue
        const badge = BADGES[badgeId]
        pushRef.current({
          icon: badge?.icon ?? '🏅',
          title: `Badge: ${badge?.name ?? badgeId}`,
          ...(badge ? { detail: badge.description } : {}),
          tone: 'badge',
        })
      }
      previous = new Set(state.badges)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const toneClasses =
    toast.tone === 'badge'
      ? 'border-cq-gold/50 bg-cq-gold/10'
      : toast.tone === 'quest'
        ? 'border-cq-good/50 bg-cq-good/10'
        : 'border-cq-accent/50 bg-cq-accent/10'

  return (
    <div
      className={[
        'cq-pop cq-panel flex max-w-64 items-center gap-2.5 px-3 py-2',
        toneClasses,
      ].join(' ')}
    >
      <span aria-hidden="true" className="text-xl">
        {toast.icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-[0.8rem] leading-tight font-bold text-cq-ink">
          {toast.title}
        </p>
        {toast.detail ? (
          <p className="text-[0.68rem] leading-snug text-cq-muted">
            {toast.detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}
