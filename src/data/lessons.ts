import type { Lesson } from './types'
import { XP } from '@/utils/constants'

/**
 * Educational content lives here as data (spec §39), never inside components.
 * Explanations are deliberately 1–2 short sentences with scannable facts —
 * spec §12 warns against long paragraphs.
 *
 * Written in Indonesian, with the computer terms themselves left in English.
 * The words a child needs to recognise later — hardware, software, CPU, RAM,
 * SSD, storage, input, output — are the same ones they will see on a product
 * box, so translating them would teach a vocabulary nobody else uses.
 */
export const LESSONS: Readonly<Record<string, Lesson>> = {
  computer: {
    id: 'computer',
    title: 'Computer',
    icon: '🖥️',
    explanation:
      'Computer adalah mesin yang menerima input, memprosesnya, lalu memberi output. Hasilnya juga disimpan supaya bisa dipakai lagi nanti.',
    facts: [
      'Input → Processing → Output → Storage',
      'Computer mengikuti instruksi dengan tepat',
      'Mereka tidak pernah bosan atau lelah',
    ],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'computer-explorer',
  },

  hardware: {
    id: 'hardware',
    title: 'Hardware',
    icon: '🔧',
    explanation:
      'Hardware adalah bagian computer yang bisa kamu pegang. Kalau bisa diangkat, itu hardware.',
    facts: ['CPU, RAM, dan GPU termasuk hardware', 'Software butuh hardware untuk berjalan'],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'hardware-apprentice',
  },

  software: {
    id: 'software',
    title: 'Software',
    icon: '💿',
    explanation:
      'Software adalah kumpulan instruksi yang memberi tahu hardware apa yang harus dilakukan. Tidak bisa disentuh, tapi kamu memakainya setiap hari.',
    facts: ['Game dan browser termasuk software', 'Software disimpan, lalu dimuat ke RAM'],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'hardware-apprentice',
  },

  input: {
    id: 'input',
    title: 'Input',
    icon: '⌨️',
    explanation:
      'Input adalah semua yang kamu kirim KE DALAM computer. Keyboard dan mouse adalah input device.',
    facts: [
      'Keyboard dan mouse adalah input device',
      'Mikrofon dan kamera juga input',
      'Input mengalir lewat kabel sebagai data',
    ],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'computer-explorer',
  },

  output: {
    id: 'output',
    title: 'Output',
    icon: '🖥️',
    explanation:
      'Output adalah yang dikirim computer KEMBALI kepadamu. Monitor dan speaker adalah output device.',
    facts: [
      'Monitor menampilkan output sebagai gambar',
      'Speaker mengubah output menjadi suara',
      'Tanpa output, computer terlihat "rusak"',
    ],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'computer-explorer',
  },

  processing: {
    id: 'processing',
    title: 'Processing',
    icon: '🧠',
    explanation:
      'Processing adalah langkah berpikir di tengah. CPU yang mengerjakannya, satu instruksi demi satu instruksi, sangat cepat.',
    facts: [
      'CPU adalah otak dari computer',
      'CPU menjalankan miliaran langkah per detik',
      'Tanpa CPU, tidak ada yang bisa berpikir',
    ],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'cpu-specialist',
  },

  storage: {
    id: 'storage',
    title: 'Storage',
    icon: '💽',
    explanation:
      'Storage menyimpan file-mu meski daya sudah dimatikan. SSD atau HDD menyimpannya sampai kamu butuh lagi.',
    facts: [
      'Storage bersifat permanen, RAM sementara',
      'SSD lebih cepat daripada HDD',
      'Foto dan game-mu tersimpan di storage',
    ],
    xp: XP.LEARN_CONCEPT,
    badgeId: 'memory-master',
  },

  ram: {
    id: 'ram',
    title: 'RAM',
    icon: '💾',
    explanation:
      'RAM menyimpan sementara data yang sedang dipakai computer saat ini juga. Sangat cepat, tapi melupakan semuanya saat daya dimatikan.',
    facts: [
      'RAM = memori jangka pendek',
      'RAM jauh lebih cepat daripada storage',
      'RAM penuh membuat semuanya melambat',
      'RAM kehilangan datanya saat daya mati',
    ],
    xp: XP.COMPLETE_MINIGAME,
    badgeId: 'memory-master',
    minigameId: 'ram-sorting',
    practicePrompt: 'Coba sendiri — jaga aplikasi yang terbuka tetap di dalam 8 GB RAM.',
  },
}

export const LESSON_LIST: readonly Lesson[] = Object.values(LESSONS)

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id]
}
