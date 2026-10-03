import type { DialogueTree } from './types'

/**
 * Dialogue content (spec §15). Lines are short on purpose — spec §14 asks for
 * a friendly guide who never lectures.
 *
 * `__QUEST_START__` style branching is avoided: branching is expressed with
 * choices and `onEnter` effects so the tree stays declarative data.
 *
 * Written in Indonesian, which is the language the game is played in. Computer
 * terms a child will meet again in English — hardware, software, RAM, CPU,
 * monitor, keyboard, input, output — stay in English on purpose, so the game
 * teaches the words they will actually encounter on a spec sheet or in a shop.
 * Everything around those terms is Indonesian.
 */

const QUEST = 'computer-has-gone-quiet'

export const DIALOGUES: Readonly<Record<string, DialogueTree>> = {
  /**
   * Professor Byte's conversation adapts to quest progress. Rather than
   * branching on state inside code, the interaction layer picks one of three
   * trees by id, which keeps this file pure content.
   */
  'professor-byte-intro': {
    id: 'professor-byte-intro',
    root: 'greet',
    nodes: {
      greet: {
        id: 'greet',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Oh! Wajah baru di Computer Village. Selamat datang, penjelajah.',
        next: 'problem',
      },
      problem: {
        id: 'problem',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Hmm... tapi aku butuh bantuan. Komputer desa ini mendadak diam.',
        choices: [
          { label: 'Apakah rusak?', next: 'explain' },
          { label: 'Sebenarnya, apa itu komputer?', next: 'teach' },
        ],
      },
      teach: {
        id: 'teach',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Mesin yang menerima input, memprosesnya, lalu memberi output. Yang ini macet di tengah-tengah.',
        onEnter: { teachLesson: 'computer' },
        next: 'explain',
      },
      explain: {
        id: 'explain',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Mungkin! Setiap komputer punya beberapa bagian penting, dan masing-masing punya tugas. Ayo kita periksa bersama.',
        next: 'offer',
      },
      offer: {
        id: 'offer',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Mulai dari monitor. Kalau layarnya kosong, kita tahu di mana TIDAK perlu mencari.',
        onEnter: { startQuest: QUEST, completeObjective: 'talk-to-byte' },
        end: true,
      },
    },
  },

  /** Shown while the investigation is underway. */
  'professor-byte-progress': {
    id: 'professor-byte-progress',
    root: 'nudge',
    nodes: {
      nudge: {
        id: 'nudge',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Sudah ada hasil? Santai saja — penjelajah yang baik memeriksa semua bagian sebelum menebak.',
        choices: [
          { label: 'Bagian mana yang harus kuperiksa?', next: 'hint' },
          { label: 'Aku lanjut mencari dulu.', next: 'bye' },
        ],
      },
      hint: {
        id: 'hint',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Monitor dulu, lalu keyboard. Kalau keduanya baik, masalahnya bersembunyi di dalam tower.',
        next: 'bye',
      },
      bye: {
        id: 'bye',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Kembalilah kalau kamu menemukan sesuatu!',
        end: true,
      },
    },
  },

  /** Shown once the RAM has been found, before installation. */
  'professor-byte-has-ram': {
    id: 'professor-byte-has-ram',
    root: 'found',
    nodes: {
      found: {
        id: 'found',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Kamu menemukan RAM module-nya! Itu memori jangka pendek komputer. Tanpa RAM, tidak ada yang bisa berpikir.',
        onEnter: { teachLesson: 'ram' },
        next: 'install',
      },
      install: {
        id: 'install',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Pasang ke dalam tower. Tapi hati-hati — RAM cepat penuh. Simpan hanya yang benar-benar dipakai komputer.',
        onEnter: { completeObjective: 'find-ram' },
        next: 'go',
      },
      go: {
        id: 'go',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Ayo, aku mengawasi dari sini.',
        end: true,
      },
    },
  },

  /** Shown after the mini-game, to close the quest out. */
  'professor-byte-complete': {
    id: 'professor-byte-complete',
    root: 'works',
    nodes: {
      works: {
        id: 'works',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Hidup lagi! Monitor-nya menyala. Kamu berhasil memperbaikinya, penjelajah.',
        onEnter: { completeObjective: 'return-to-byte' },
        next: 'recap',
      },
      recap: {
        id: 'recap',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Input, processing, output, storage — dan RAM yang menyatukan semuanya. Hari ini kamu mempelajari itu semua.',
        next: 'reward',
      },
      reward: {
        id: 'reward',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Ini — sebuah Hardware Lab pass. Lab-nya ada di utara plaza. Masih banyak yang bisa kamu temukan di sana.',
        end: true,
      },
    },
  },

  /** Fallback chat when the quest is already done. */
  'professor-byte-done': {
    id: 'professor-byte-done',
    root: 'chat',
    nodes: {
      chat: {
        id: 'chat',
        speaker: 'Professor Byte',
        portrait: '🧑‍🔬',
        text: 'Lab-nya sudah terbuka. Lihat-lihatlah — setiap komponen di sana punya cerita.',
        end: true,
      },
    },
  },
}

export function getDialogue(id: string): DialogueTree | undefined {
  return DIALOGUES[id]
}

/** Picks the right Professor Byte conversation for the current quest state. */
export function resolveByteDialogue(state: {
  questActive: boolean
  questComplete: boolean
  hasRam: boolean
  returnedToByte: boolean
}): string {
  if (state.questComplete) return 'professor-byte-done'
  if (state.returnedToByte) return 'professor-byte-complete'
  if (state.hasRam) return 'professor-byte-has-ram'
  if (state.questActive) return 'professor-byte-progress'
  return 'professor-byte-intro'
}
