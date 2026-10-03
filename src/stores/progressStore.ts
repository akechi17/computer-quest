import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { tierForXp, nextTierAfter } from '@/data/badges'
import type { LevelTier, QuestDefinition } from '@/data/types'

/**
 * Persistent player progress (spec §5 data layer, §27 save system).
 *
 * The store deliberately holds *no* rendering state — no positions, no
 * velocities, no interaction targets. Those live in `game/` and in the
 * ephemeral stores. This keeps a save file small and makes it trivially
 * swappable for the Laravel API described in spec §28.
 */

export type QuestStatus = 'locked' | 'active' | 'complete'

export interface QuestProgress {
  status: QuestStatus
  completedObjectiveIds: string[]
}

export interface InventoryEntry {
  itemId: string
  quantity: number
}

export interface ProgressSnapshot {
  version: number
  xp: number
  coins: number
  badges: string[]
  completedLessonIds: string[]
  unlockedZoneIds: string[]
  questProgress: Record<string, QuestProgress>
  inventory: InventoryEntry[]
  playSeconds: number
  updatedAt: string
}

export interface ProgressState {
  xp: number
  coins: number
  badges: string[]
  completedLessonIds: string[]
  unlockedZoneIds: string[]
  questProgress: Record<string, QuestProgress>
  inventory: InventoryEntry[]
  playSeconds: number

  /* Derived helpers */
  level: () => number
  levelTitle: () => string
  xpIntoLevel: () => number
  xpForNextLevel: () => number | null
  nextTier: () => LevelTier | null

  /* Mutations */
  addXp: (amount: number) => void
  addCoins: (amount: number) => void
  awardBadge: (badgeId: string) => void
  completeLesson: (lessonId: string) => void
  hasCompletedLesson: (lessonId: string) => boolean
  unlockZone: (zoneId: string) => void
  isZoneUnlocked: (zoneId: string) => boolean

  startQuest: (questId: string) => void
  completeObjective: (questId: string, objectiveId: string) => void
  completeQuest: (quest: QuestDefinition) => void
  getQuestStatus: (questId: string) => QuestStatus
  isObjectiveComplete: (questId: string, objectiveId: string) => boolean
  activeObjectiveId: (quest: QuestDefinition) => string | null
  isQuestFullyComplete: (quest: QuestDefinition) => boolean

  addItem: (itemId: string, quantity?: number) => void
  removeItem: (itemId: string, quantity?: number) => void
  itemCount: (itemId: string) => number
  hasItem: (itemId: string) => boolean

  addPlayTime: (seconds: number) => void
  exportSnapshot: () => ProgressSnapshot
  importSnapshot: (snapshot: ProgressSnapshot) => void
  resetProgress: () => void
}

const SNAPSHOT_VERSION = 1

function emptyQuestProgress(): QuestProgress {
  return { status: 'locked', completedObjectiveIds: [] }
}

/** Removes duplicates while preserving first-seen order. */
function uniq(values: string[]): string[] {
  return Array.from(new Set(values))
}

const INITIAL = {
  xp: 0,
  coins: 0,
  badges: [] as string[],
  completedLessonIds: [] as string[],
  unlockedZoneIds: ['computer-village'],
  questProgress: {} as Record<string, QuestProgress>,
  inventory: [] as InventoryEntry[],
  playSeconds: 0,
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      /* ---------------------------------------------------------------- */
      /* Derived                                                           */
      /* ---------------------------------------------------------------- */
      level: () => tierForXp(get().xp).level,
      levelTitle: () => tierForXp(get().xp).title,
      xpIntoLevel: () => {
        const xp = get().xp
        return xp - tierForXp(xp).xpRequired
      },
      xpForNextLevel: () => {
        const next = nextTierAfter(get().xp)
        return next ? next.xpRequired - tierForXp(get().xp).xpRequired : null
      },
      nextTier: () => nextTierAfter(get().xp),

      /* ---------------------------------------------------------------- */
      /* Currency & achievements                                           */
      /* ---------------------------------------------------------------- */
      addXp: (amount) => set((s) => ({ xp: Math.max(0, s.xp + amount) })),
      addCoins: (amount) => set((s) => ({ coins: Math.max(0, s.coins + amount) })),

      awardBadge: (badgeId) =>
        set((s) =>
          s.badges.includes(badgeId) ? s : { badges: [...s.badges, badgeId] },
        ),

      completeLesson: (lessonId) =>
        set((s) =>
          s.completedLessonIds.includes(lessonId)
            ? s
            : { completedLessonIds: [...s.completedLessonIds, lessonId] },
        ),

      hasCompletedLesson: (lessonId) => get().completedLessonIds.includes(lessonId),

      unlockZone: (zoneId) =>
        set((s) =>
          s.unlockedZoneIds.includes(zoneId)
            ? s
            : { unlockedZoneIds: [...s.unlockedZoneIds, zoneId] },
        ),

      isZoneUnlocked: (zoneId) => get().unlockedZoneIds.includes(zoneId),

      /* ---------------------------------------------------------------- */
      /* Quests                                                            */
      /* ---------------------------------------------------------------- */
      startQuest: (questId) =>
        set((s) => {
          const existing = s.questProgress[questId]
          if (existing && existing.status !== 'locked') return s
          return {
            questProgress: {
              ...s.questProgress,
              [questId]: { status: 'active', completedObjectiveIds: [] },
            },
          }
        }),

      completeObjective: (questId, objectiveId) =>
        set((s) => {
          const current = s.questProgress[questId] ?? emptyQuestProgress()
          if (current.completedObjectiveIds.includes(objectiveId)) return s
          return {
            questProgress: {
              ...s.questProgress,
              [questId]: {
                status: current.status === 'complete' ? 'complete' : 'active',
                completedObjectiveIds: [
                  ...current.completedObjectiveIds,
                  objectiveId,
                ],
              },
            },
          }
        }),

      /**
       * Marks a quest complete and applies its rewards exactly once. Rewards
       * are idempotent because quests are only ever completed a single time.
       */
      completeQuest: (quest) =>
        set((s) => {
          const current = s.questProgress[quest.id]
          if (current?.status === 'complete') return s

          const rewards = quest.rewards
          return {
            questProgress: {
              ...s.questProgress,
              [quest.id]: {
                status: 'complete',
                completedObjectiveIds:
                  current?.completedObjectiveIds ??
                  quest.objectives.map((o) => o.id),
              },
            },
            xp: s.xp + (rewards.xp ?? 0),
            coins: s.coins + (rewards.coins ?? 0),
            badges: uniq([...s.badges, ...(rewards.badges ?? [])]),
            unlockedZoneIds: uniq([
              ...s.unlockedZoneIds,
              ...(rewards.unlockedZones ?? []),
            ]),
            inventory: (rewards.items ?? []).reduce<InventoryEntry[]>(
              (acc, itemId) => addToInventory(acc, itemId, 1),
              s.inventory,
            ),
          }
        }),

      getQuestStatus: (questId) => get().questProgress[questId]?.status ?? 'locked',

      isObjectiveComplete: (questId, objectiveId) =>
        get().questProgress[questId]?.completedObjectiveIds.includes(objectiveId) ??
        false,

      activeObjectiveId: (quest) => {
        const progress = get().questProgress[quest.id]
        if (!progress || progress.status !== 'active') return null
        const next = quest.objectives.find(
          (o) => !progress.completedObjectiveIds.includes(o.id),
        )
        return next?.id ?? null
      },

      isQuestFullyComplete: (quest) => {
        const progress = get().questProgress[quest.id]
        if (!progress) return false
        return quest.objectives.every((o) =>
          progress.completedObjectiveIds.includes(o.id),
        )
      },

      /* ---------------------------------------------------------------- */
      /* Inventory                                                         */
      /* ---------------------------------------------------------------- */
      addItem: (itemId, quantity = 1) =>
        set((s) => ({ inventory: addToInventory(s.inventory, itemId, quantity) })),

      removeItem: (itemId, quantity = 1) =>
        set((s) => ({
          inventory: s.inventory
            .map((entry) =>
              entry.itemId === itemId
                ? { ...entry, quantity: entry.quantity - quantity }
                : entry,
            )
            .filter((entry) => entry.quantity > 0),
        })),

      itemCount: (itemId) =>
        get().inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0,

      hasItem: (itemId) => get().itemCount(itemId) > 0,

      /* ---------------------------------------------------------------- */
      /* Session                                                           */
      /* ---------------------------------------------------------------- */
      addPlayTime: (seconds) => set((s) => ({ playSeconds: s.playSeconds + seconds })),

      exportSnapshot: () => {
        const s = get()
        return {
          version: SNAPSHOT_VERSION,
          xp: s.xp,
          coins: s.coins,
          badges: s.badges,
          completedLessonIds: s.completedLessonIds,
          unlockedZoneIds: s.unlockedZoneIds,
          questProgress: s.questProgress,
          inventory: s.inventory,
          playSeconds: s.playSeconds,
          updatedAt: new Date().toISOString(),
        }
      },

      importSnapshot: (snapshot) =>
        set({
          xp: snapshot.xp,
          coins: snapshot.coins,
          badges: snapshot.badges,
          completedLessonIds: snapshot.completedLessonIds,
          unlockedZoneIds: snapshot.unlockedZoneIds,
          questProgress: snapshot.questProgress,
          inventory: snapshot.inventory,
          playSeconds: snapshot.playSeconds,
        }),

      resetProgress: () => set({ ...INITIAL }),
    }),
    {
      name: 'computer-quest:progress',
      version: SNAPSHOT_VERSION,
      partialize: (state) => ({
        xp: state.xp,
        coins: state.coins,
        badges: state.badges,
        completedLessonIds: state.completedLessonIds,
        unlockedZoneIds: state.unlockedZoneIds,
        questProgress: state.questProgress,
        inventory: state.inventory,
        playSeconds: state.playSeconds,
      }),
    },
  ),
)

function addToInventory(
  inventory: InventoryEntry[],
  itemId: string,
  quantity: number,
): InventoryEntry[] {
  const existing = inventory.find((entry) => entry.itemId === itemId)
  if (!existing) return [...inventory, { itemId, quantity }]
  return inventory.map((entry) =>
    entry.itemId === itemId
      ? { ...entry, quantity: entry.quantity + quantity }
      : entry,
  )
}
