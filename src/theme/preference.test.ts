import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../document/storage'
import {
  loadThemeChoice,
  saveThemeChoice,
  THEME_STORAGE_KEY,
} from './preference'

const memoryStorage = (initial: Record<string, string> = {}): StorageLike => {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('loadThemeChoice', () => {
  it('follows Omarchy by default', () => {
    expect(loadThemeChoice(memoryStorage())).toBe('omarchy')
    expect(loadThemeChoice(null)).toBe('omarchy')
    expect(loadThemeChoice(throwingStorage)).toBe('omarchy')
  })

  it('reads a saved choice and ignores unknown values', () => {
    expect(
      loadThemeChoice(memoryStorage({ [THEME_STORAGE_KEY]: 'chiri' })),
    ).toBe('chiri')
    expect(
      loadThemeChoice(memoryStorage({ [THEME_STORAGE_KEY]: 'neon' })),
    ).toBe('omarchy')
  })
})

describe('saveThemeChoice', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    saveThemeChoice(storage, 'chiri')
    expect(loadThemeChoice(storage)).toBe('chiri')
  })

  it('swallows storage errors', () => {
    expect(() => saveThemeChoice(throwingStorage, 'chiri')).not.toThrow()
  })
})
