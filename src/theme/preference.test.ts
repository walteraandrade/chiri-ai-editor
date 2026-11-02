import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../document/storage'
import {
  activeTheme,
  loadThemeChoice,
  saveThemeChoice,
  THEME_STORAGE_KEY,
} from './preference'
import type { ThemeTokens } from './tokens'

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

describe('activeTheme', () => {
  const vantablack: ThemeTokens = {
    name: 'vantablack',
    mode: 'dark',
    bg: '#000000',
    raised: null,
    ink: '#ffffff',
    inkStrong: '#ffffff',
    accent: '#8d8d8d',
    ai: '#8d8d8d',
    danger: null,
    selection: null,
  }

  it('uses the Omarchy theme when chosen and present', () => {
    expect(activeTheme('omarchy', vantablack)).toBe(vantablack)
  })

  it('falls back to the Chiri theme otherwise', () => {
    expect(activeTheme('chiri', vantablack)).toBeNull()
    expect(activeTheme('omarchy', null)).toBeNull()
  })
})
