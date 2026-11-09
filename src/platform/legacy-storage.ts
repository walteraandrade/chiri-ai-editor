import type { StorageLike } from '../document/storage'
import { THEME_STORAGE_KEY } from '../theme/preference'

export type ListableStorage = StorageLike & Pick<Storage, 'length' | 'key'>

const LEGACY_PREFIX = 'chiri.'
const PREFIX = 'desafinado.'
const LEGACY_THEME = 'chiri'
const THEME = 'desafinado'

export const getListableStorage = (): ListableStorage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const storedKeys = (storage: ListableStorage): readonly string[] =>
  Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key): key is string => key !== null)

const migratedValue = (key: string, value: string): string =>
  key === THEME_STORAGE_KEY && value === LEGACY_THEME ? THEME : value

export const migrateLegacyStorage = (storage: ListableStorage | null): void => {
  if (storage === null) return
  try {
    for (const legacyKey of storedKeys(storage).filter((key) =>
      key.startsWith(LEGACY_PREFIX),
    )) {
      const key = PREFIX + legacyKey.slice(LEGACY_PREFIX.length)
      const value = storage.getItem(legacyKey)
      if (value !== null && storage.getItem(key) === null)
        storage.setItem(key, migratedValue(key, value))
    }
  } catch {}
}
