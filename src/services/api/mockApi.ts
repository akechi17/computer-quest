import type { ProgressSnapshot } from '@/stores/progressStore'
import { isRecord } from '@/utils/id'
import type {
  ApiResult,
  GameApi,
  LessonCompletionRequest,
  LoginRequest,
  LoginResponse,
  PlayerProfile,
  QuestCompletionRequest,
} from './types'

/**
 * A local implementation of the API contract (spec §27, §28).
 *
 * "For the MVP, create a local mock persistence layer. Structure the code so
 * the API can replace it later."
 *
 * This writes to localStorage under its own key, separate from the Zustand
 * persist key, so the two layers can diverge without corrupting each other —
 * the store owns live state, this owns the "server's" copy.
 */

const STORAGE_KEY = 'computer-quest:mock-api'
const TOKEN_KEY = 'computer-quest:mock-api-token'
const LATENCY_MS = 180

interface MockDatabase {
  profile: PlayerProfile | null
  progress: ProgressSnapshot | null
  completedQuests: string[]
  completedLessons: string[]
}

const EMPTY_DB: MockDatabase = {
  profile: null,
  progress: null,
  completedQuests: [],
  completedLessons: [],
}

/** Simulates network latency so loading states are exercised in development. */
function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), LATENCY_MS)
  })
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail<T>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function readDatabase(): MockDatabase {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_DB }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...EMPTY_DB }

    return {
      profile: (parsed.profile as PlayerProfile | null) ?? null,
      progress: (parsed.progress as ProgressSnapshot | null) ?? null,
      completedQuests: Array.isArray(parsed.completedQuests)
        ? (parsed.completedQuests as string[])
        : [],
      completedLessons: Array.isArray(parsed.completedLessons)
        ? (parsed.completedLessons as string[])
        : [],
    }
  } catch {
    // A corrupted or unavailable store must not brick the game.
    return { ...EMPTY_DB }
  }
}

function writeDatabase(db: MockDatabase): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Quota or private-mode failures are non-fatal; in-memory state persists.
  }
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Non-fatal.
  }
}

export const mockApi: GameApi = {
  async login(request: LoginRequest): Promise<ApiResult<LoginResponse>> {
    await delay(null)

    const db = readDatabase()
    const playerId = db.profile?.id ?? `player_${crypto.randomUUID()}`

    const profile: PlayerProfile = {
      id: playerId,
      displayName: request.displayName || 'Explorer',
      createdAt: db.profile?.createdAt ?? new Date().toISOString(),
    }

    const token = `mock.${playerId}.${Date.now()}`
    writeToken(token)
    writeDatabase({ ...db, profile })

    return ok({
      token,
      playerId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    })
  },

  async getPlayer(): Promise<ApiResult<PlayerProfile>> {
    await delay(null)
    if (!readToken()) return fail('unauthorized', 'Not signed in.')
    const db = readDatabase()
    if (!db.profile) return fail('not_found', 'No player profile yet.')
    return ok(db.profile)
  },

  async getProgress(): Promise<ApiResult<ProgressSnapshot>> {
    await delay(null)
    if (!readToken()) return fail('unauthorized', 'Not signed in.')
    const db = readDatabase()
    if (!db.progress) return fail('not_found', 'No saved progress yet.')
    return ok(db.progress)
  },

  async saveProgress(
    snapshot: ProgressSnapshot,
  ): Promise<ApiResult<ProgressSnapshot>> {
    await delay(null)
    if (!readToken()) return fail('unauthorized', 'Not signed in.')

    const db = readDatabase()
    writeDatabase({ ...db, progress: snapshot })
    return ok(snapshot)
  },

  async completeQuest(
    request: QuestCompletionRequest,
  ): Promise<ApiResult<void>> {
    await delay(null)
    if (!readToken()) return fail('unauthorized', 'Not signed in.')

    const db = readDatabase()
    if (db.completedQuests.includes(request.questId)) {
      // Idempotent: completing twice is a no-op, not an error.
      return ok(undefined)
    }

    writeDatabase({
      ...db,
      completedQuests: [...db.completedQuests, request.questId],
    })
    return ok(undefined)
  },

  async completeLesson(
    request: LessonCompletionRequest,
  ): Promise<ApiResult<void>> {
    await delay(null)
    if (!readToken()) return fail('unauthorized', 'Not signed in.')

    const db = readDatabase()
    if (db.completedLessons.includes(request.lessonId)) return ok(undefined)

    writeDatabase({
      ...db,
      completedLessons: [...db.completedLessons, request.lessonId],
    })
    return ok(undefined)
  },
}
