import type { QuestProgress } from '@/stores/progressStore'

export interface ProgressSummary {
  total: number
  completed: number
  active: number
}

/** Small derived counts used by the title screen and profile panel. */
export function levelSummary(
  questProgress: Record<string, QuestProgress>,
): ProgressSummary {
  let completed = 0
  let active = 0

  for (const progress of Object.values(questProgress)) {
    if (progress.status === 'complete') completed += 1
    else if (progress.status === 'active') active += 1
  }

  return { total: completed + active, completed, active }
}
