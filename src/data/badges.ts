import type { BadgeDefinition, LevelTier } from './types'

export const BADGES: Readonly<Record<string, BadgeDefinition>> = {
  'computer-explorer': {
    id: 'computer-explorer',
    name: 'Computer Explorer',
    icon: '💻',
    description: 'Learned what a computer is and how input and output work.',
  },
  'hardware-apprentice': {
    id: 'hardware-apprentice',
    name: 'Hardware Apprentice',
    icon: '🔧',
    description: 'Can tell hardware apart from software.',
  },
  'cpu-specialist': {
    id: 'cpu-specialist',
    name: 'CPU Specialist',
    icon: '🧠',
    description: 'Understands how the processor does its thinking.',
  },
  'memory-master': {
    id: 'memory-master',
    name: 'Memory Master',
    icon: '💾',
    description: 'Knows how RAM and storage work together.',
  },
  'network-explorer': {
    id: 'network-explorer',
    name: 'Network Explorer',
    icon: '🌐',
    description: 'Understands how computers talk to each other.',
  },
  'cyber-guardian': {
    id: 'cyber-guardian',
    name: 'Cyber Guardian',
    icon: '🛡️',
    description: 'Can spot phishing and keep accounts safe.',
  },
  'algorithm-apprentice': {
    id: 'algorithm-apprentice',
    name: 'Algorithm Apprentice',
    icon: '🤖',
    description: 'Can break a problem into clear steps.',
  },
}

export const BADGE_LIST: readonly BadgeDefinition[] = Object.values(BADGES)

/**
 * Level curve (spec §24). Thresholds are intentionally generous — the spec is
 * explicit that progression should motivate exploration, never gate learning.
 */
export const LEVEL_TIERS: readonly LevelTier[] = [
  { level: 1, title: 'Computer Explorer', xpRequired: 0 },
  { level: 2, title: 'Hardware Apprentice', xpRequired: 120 },
  { level: 3, title: 'Hardware Builder', xpRequired: 300 },
  { level: 4, title: 'Network Explorer', xpRequired: 560 },
  { level: 5, title: 'Cyber Guardian', xpRequired: 900 },
  { level: 6, title: 'Junior Programmer', xpRequired: 1320 },
]

export function tierForXp(xp: number): LevelTier {
  let current = LEVEL_TIERS[0]!
  for (const tier of LEVEL_TIERS) {
    if (xp >= tier.xpRequired) current = tier
    else break
  }
  return current
}

/** Returns the next tier, or null when the player has maxed the curve. */
export function nextTierAfter(xp: number): LevelTier | null {
  for (const tier of LEVEL_TIERS) {
    if (xp < tier.xpRequired) return tier
  }
  return null
}
