import type { ItemDefinition } from './types'

export const ITEMS: Readonly<Record<string, ItemDefinition>> = {
  'ram-module': {
    id: 'ram-module',
    name: 'RAM Module',
    icon: '💾',
    category: 'hardware',
    description: 'An 8 GB memory stick. The village computer is missing one.',
    stackable: false,
  },
  'screwdriver': {
    id: 'screwdriver',
    name: 'Screwdriver',
    icon: '🪛',
    category: 'tool',
    description: 'Professor Byte lent you this. Opens computer cases.',
    stackable: false,
  },
  'lab-pass': {
    id: 'lab-pass',
    name: 'Hardware Lab Pass',
    icon: '🎫',
    category: 'key',
    description: 'Earned by repairing the village computer. Opens the Hardware Lab.',
    stackable: false,
  },
  'data-crystal': {
    id: 'data-crystal',
    name: 'Data Crystal',
    icon: '💎',
    category: 'collectible',
    description: 'A shard of pure information. Collect them while you explore.',
    stackable: true,
  },
}

export const ITEM_LIST: readonly ItemDefinition[] = Object.values(ITEMS)

export function getItem(id: string): ItemDefinition | undefined {
  return ITEMS[id]
}
