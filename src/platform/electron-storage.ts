import type { StorageLike } from '../document/storage'

export const LAST_FILE_KEY = 'chiri.lastFile'

export type RemovableStorage = StorageLike & Pick<Storage, 'removeItem'>

export const getRemovableStorage = (): RemovableStorage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const loadLastFile = (storage: StorageLike | null): string | null => {
  try {
    return storage?.getItem(LAST_FILE_KEY) ?? null
  } catch {
    return null
  }
}

export const clearLastFile = (storage: RemovableStorage | null): void => {
  try {
    storage?.removeItem(LAST_FILE_KEY)
  } catch {
    return
  }
}

export const saveLastFile = (
  storage: StorageLike | null,
  path: string,
): void => {
  try {
    storage?.setItem(LAST_FILE_KEY, path)
  } catch {
    return
  }
}
