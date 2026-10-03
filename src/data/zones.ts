import type { ZoneDefinition } from './types'

/**
 * Zones are the top-level progression gates (spec §8). Only Computer Village
 * and Hardware Lab exist in the MVP, but the list is the extension point for
 * Internet City, Cyber Security District and Programming Factory.
 */
export const ZONES: Readonly<Record<string, ZoneDefinition>> = {
  'computer-village': {
    id: 'computer-village',
    name: 'Computer Village',
    description: 'A friendly village built around a giant computer monument.',
    anchor: [0, 0, 0],
    unlockedAtStart: true,
  },
  'hardware-lab': {
    id: 'hardware-lab',
    name: 'Hardware Lab',
    description: 'A workshop where every component of a PC is on display.',
    anchor: [0, 0, -34],
    unlockedAtStart: false,
  },
  'internet-city': {
    id: 'internet-city',
    name: 'Internet City',
    description: 'Packets race between towers. Not built yet.',
    anchor: [34, 0, 0],
    unlockedAtStart: false,
  },
  'cyber-security-district': {
    id: 'cyber-security-district',
    name: 'Cyber Security District',
    description: 'Where passwords are tested and phishing is hunted.',
    anchor: [-34, 0, 0],
    unlockedAtStart: false,
  },
  'programming-factory': {
    id: 'programming-factory',
    name: 'Programming Factory',
    description: 'Algorithms assembled on a conveyor belt.',
    anchor: [0, 0, 34],
    unlockedAtStart: false,
  },
}

export const ZONE_LIST: readonly ZoneDefinition[] = Object.values(ZONES)

export function getZone(id: string): ZoneDefinition | undefined {
  return ZONES[id]
}
