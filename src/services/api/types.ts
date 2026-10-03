import type { ProgressSnapshot } from '@/stores/progressStore'

/**
 * The API contract (spec §28).
 *
 * These types describe the Laravel endpoints the game will eventually talk to.
 * Nothing here imports a store or a React hook — the shape is deliberately
 * transport-agnostic so the mock implementation can be swapped for a real HTTP
 * client without touching a single call site.
 */

export interface LoginRequest {
  /** Anonymous device identity in the MVP; a real account later. */
  deviceId: string
  displayName: string
}

export interface LoginResponse {
  token: string
  playerId: string
  expiresAt: string
}

export interface PlayerProfile {
  id: string
  displayName: string
  createdAt: string
}

export interface QuestCompletionRequest {
  questId: string
  /** ISO timestamp of when the client observed completion. */
  completedAt: string
}

export interface LessonCompletionRequest {
  lessonId: string
  completedAt: string
}

export interface ApiError {
  /** Machine-readable code, e.g. "unauthorized". */
  code: string
  /** Human-readable message, safe to show in a toast. */
  message: string
  /** HTTP status, when the error came from a response rather than the network. */
  status?: number
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

/**
 * The full surface the game needs. Every method returns `ApiResult` rather
 * than throwing, so callers must handle failure — important because the spec
 * requires the game to keep working offline (spec §27, §30).
 */
export interface GameApi {
  login(request: LoginRequest): Promise<ApiResult<LoginResponse>>
  getPlayer(): Promise<ApiResult<PlayerProfile>>
  getProgress(): Promise<ApiResult<ProgressSnapshot>>
  saveProgress(snapshot: ProgressSnapshot): Promise<ApiResult<ProgressSnapshot>>
  completeQuest(request: QuestCompletionRequest): Promise<ApiResult<void>>
  completeLesson(request: LessonCompletionRequest): Promise<ApiResult<void>>
}
