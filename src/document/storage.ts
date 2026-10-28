export const DOCUMENT_STORAGE_KEY = 'chiri.document'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const getLocalStorage = (): StorageLike | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const loadDocument = (
  storage: StorageLike | null,
  fallback: string,
): string => {
  try {
    return storage?.getItem(DOCUMENT_STORAGE_KEY) ?? fallback
  } catch {
    return fallback
  }
}

export const saveDocument = (
  storage: StorageLike | null,
  text: string,
): boolean => {
  try {
    storage?.setItem(DOCUMENT_STORAGE_KEY, text)
    return storage !== null
  } catch {
    return false
  }
}
