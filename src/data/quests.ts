import type { QuestDefinition } from './types'
import { XP } from '@/utils/constants'
import { villageObj } from './world'

/**
 * Quest definitions (spec §16). Objectives are ordered and generally advance
 * one at a time, but the store only enforces order for objectives that depend
 * on a previous one; exploration objectives can complete in any order.
 *
 * "The Computer Has Gone Quiet" — spec §13.
 *
 * Player-facing text is Indonesian; the computer terms inside it stay English.
 */
export const QUESTS: Readonly<Record<string, QuestDefinition>> = {
  'computer-has-gone-quiet': {
    id: 'computer-has-gone-quiet',
    title: 'The Computer Has Gone Quiet',
    description:
      'Komputer desa berhenti bekerja. Professor Byte butuh bantuan untuk mencari tahu penyebabnya.',
    intro:
      'Ada yang tidak beres dengan komputer besar di plaza. Ayo periksa bagian-bagiannya, satu per satu.',
    objectives: [
      {
        id: 'talk-to-byte',
        kind: 'talk_to',
        label: 'Bicara dengan Professor Byte',
        target: 'professor-byte',
        hint: 'Byte berdiri di dekat monument.',
      },
      {
        id: 'inspect-monitor',
        kind: 'interact',
        label: 'Periksa monitor',
        target: villageObj('village-computer-monitor'),
        hint: 'Layarnya tetap gelap.',
      },
      {
        id: 'inspect-keyboard',
        kind: 'interact',
        label: 'Periksa keyboard',
        target: villageObj('village-computer-keyboard'),
      },
      {
        id: 'inspect-tower',
        kind: 'interact',
        label: 'Buka tower komputer',
        target: villageObj('village-computer-tower'),
        hint: 'Ada yang hilang di dalamnya.',
      },
      {
        id: 'find-ram',
        kind: 'collect',
        label: 'Temukan RAM module yang hilang',
        target: 'ram-module',
        hint: 'Byte menyebut soal memory stick yang bisa berubah bentuk...',
      },
      {
        id: 'install-ram',
        kind: 'solve_puzzle',
        label: 'Pasang RAM module',
        target: 'ram-sorting',
        hint: 'Kembali ke tower dan pasang.',
      },
      {
        id: 'return-to-byte',
        kind: 'talk_to',
        label: 'Katakan pada Professor Byte komputer sudah menyala',
        target: 'professor-byte',
      },
    ],
    rewards: {
      xp: XP.COMPLETE_QUEST,
      coins: 25,
      badges: ['computer-explorer'],
      items: ['lab-pass'],
      unlockedZones: ['hardware-lab'],
    },
  },
}

export const QUEST_LIST: readonly QuestDefinition[] = Object.values(QUESTS)
export const FIRST_QUEST_ID = 'computer-has-gone-quiet'

export function getQuest(id: string): QuestDefinition | undefined {
  return QUESTS[id]
}
