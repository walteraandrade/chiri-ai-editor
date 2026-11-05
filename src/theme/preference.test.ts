import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../document/storage'
import { BOOK_PALETTES, CHIRI_THEME, DEFAULT_THEME } from './catalog'
import {
  activeTheme,
  loadThemeChoice,
  OMARCHY_CHOICE,
  saveThemeChoice,
  selectedOption,
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

const MOOD_INDIGO = 'mood-indigo'

const omarchy: ThemeTokens = {
  name: 'vantablack',
  mode: 'dark',
  roles: CHIRI_THEME.tokens.roles,
}

describe('loadThemeChoice', () => {
  it('follows Omarchy by default', () => {
    expect(loadThemeChoice(memoryStorage())).toBe(OMARCHY_CHOICE)
    expect(loadThemeChoice(null)).toBe(OMARCHY_CHOICE)
    expect(loadThemeChoice(throwingStorage)).toBe(OMARCHY_CHOICE)
  })

  it('reads a saved theme and ignores unknown values', () => {
    expect(
      loadThemeChoice(memoryStorage({ [THEME_STORAGE_KEY]: 'chiri' })),
    ).toBe('chiri')
    expect(
      loadThemeChoice(memoryStorage({ [THEME_STORAGE_KEY]: MOOD_INDIGO })),
    ).toBe(MOOD_INDIGO)
    expect(
      loadThemeChoice(memoryStorage({ [THEME_STORAGE_KEY]: 'neon' })),
    ).toBe(OMARCHY_CHOICE)
  })
})

describe('saveThemeChoice', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    saveThemeChoice(storage, MOOD_INDIGO)
    expect(loadThemeChoice(storage)).toBe(MOOD_INDIGO)
  })

  it('swallows storage errors', () => {
    expect(() => saveThemeChoice(throwingStorage, 'chiri')).not.toThrow()
  })
})

describe('activeTheme', () => {
  it('uses Omarchy when chosen and present', () => {
    expect(activeTheme(OMARCHY_CHOICE, omarchy)).toBe(omarchy)
  })

  it('falls back to the default theme without Omarchy', () => {
    expect(activeTheme(OMARCHY_CHOICE, null)).toBe(DEFAULT_THEME.tokens)
  })

  it('uses the chosen theme, even with Omarchy present', () => {
    expect(activeTheme(MOOD_INDIGO, omarchy).name).toBe(MOOD_INDIGO)
    expect(activeTheme('chiri', omarchy)).toBe(CHIRI_THEME.tokens)
  })

  it('falls back to the default theme for an unknown id', () => {
    expect(activeTheme('neon', null)).toBe(DEFAULT_THEME.tokens)
  })

  it('knows every palette', () => {
    for (const { id } of BOOK_PALETTES)
      expect(activeTheme(id, null).name).toBe(id)
  })
})

describe('selectedOption', () => {
  it('marks Omarchy only when it is present', () => {
    expect(selectedOption(OMARCHY_CHOICE, omarchy)).toBe(OMARCHY_CHOICE)
    expect(selectedOption(OMARCHY_CHOICE, null)).toBe(DEFAULT_THEME.id)
  })

  it('marks the chosen theme', () => {
    expect(selectedOption(MOOD_INDIGO, null)).toBe(MOOD_INDIGO)
  })
})
