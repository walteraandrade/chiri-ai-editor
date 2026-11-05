import type { StorageLike } from '../document/storage'
import { CHIRI_THEME, themeById } from './catalog'
import type { ThemeTokens } from './tokens'

export const THEME_STORAGE_KEY = 'chiri.theme'

export const OMARCHY_CHOICE = 'omarchy'

export type ThemeChoice = string

export const loadThemeChoice = (storage: StorageLike | null): ThemeChoice => {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY) ?? null
    return stored !== null && themeById(stored) !== null
      ? stored
      : OMARCHY_CHOICE
  } catch {
    return OMARCHY_CHOICE
  }
}

export const saveThemeChoice = (
  storage: StorageLike | null,
  choice: ThemeChoice,
): void => {
  try {
    storage?.setItem(THEME_STORAGE_KEY, choice)
  } catch {}
}

export const activeTheme = (
  choice: ThemeChoice,
  omarchy: ThemeTokens | null,
): ThemeTokens =>
  choice === OMARCHY_CHOICE && omarchy !== null
    ? omarchy
    : (themeById(choice) ?? CHIRI_THEME).tokens

export const selectedOption = (
  choice: ThemeChoice,
  omarchy: ThemeTokens | null,
): string =>
  choice === OMARCHY_CHOICE && omarchy === null ? CHIRI_THEME.id : choice
