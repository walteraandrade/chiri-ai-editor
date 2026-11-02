import type { StorageLike } from '../document/storage'

export const THEME_STORAGE_KEY = 'chiri.theme'

export type ThemeChoice = 'omarchy' | 'chiri'

export const loadThemeChoice = (storage: StorageLike | null): ThemeChoice => {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) === 'chiri' ? 'chiri' : 'omarchy'
  } catch {
    return 'omarchy'
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
