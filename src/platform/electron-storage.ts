import type { StorageLike } from '../document/storage'
import type { Unsaved } from '../document/unsaved'
import type { UnsavedStore } from './kit'

export const UNSAVED_KEY_PREFIX = 'chiri.unsaved:'
export const LAST_FILE_KEY = 'chiri.lastFile'

export type RemovableStorage = StorageLike & Pick<Storage, 'removeItem'>

export const getRemovableStorage = (): RemovableStorage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const unsavedKey = (path: string): string => `${UNSAVED_KEY_PREFIX}${path}`

const isUnsaved = (value: unknown): value is Unsaved =>
  typeof value === 'object' &&
  value !== null &&
  'text' in value &&
  'base' in value &&
  typeof value.text === 'string' &&
  typeof value.base === 'string'

const readUnsaved = (
  storage: RemovableStorage | null,
  path: string,
): Unsaved | null => {
  try {
    const raw = storage?.getItem(unsavedKey(path))
    if (raw === null || raw === undefined) return null
    const parsed: unknown = JSON.parse(raw)
    return isUnsaved(parsed) ? { text: parsed.text, base: parsed.base } : null
  } catch {
    return null
  }
}

export const createLocalUnsavedStore = (
  storage: RemovableStorage | null,
  afterWrite: () => void = () => undefined,
): UnsavedStore<string> => ({
  load: async (path) => readUnsaved(storage, path),
  keep: (path, unsaved) => {
    if (storage === null) return
    try {
      storage.setItem(unsavedKey(path), JSON.stringify(unsaved))
    } catch {
      return
    }
    afterWrite()
  },
  drop: (path) => {
    try {
      storage?.removeItem(unsavedKey(path))
    } catch {
      return
    }
    afterWrite()
  },
})

export const loadLastFile = (storage: StorageLike | null): string | null => {
  try {
    return storage?.getItem(LAST_FILE_KEY) ?? null
  } catch {
    return null
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
