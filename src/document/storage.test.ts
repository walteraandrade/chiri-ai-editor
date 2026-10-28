import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_STORAGE_KEY,
  loadDocument,
  type StorageLike,
  saveDocument,
} from './storage'

const createFakeStorage = (
  initial: Record<string, string> = {},
): StorageLike & { readonly entries: () => Record<string, string> } => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    entries: () => Object.fromEntries(data),
  }
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('storage unavailable')
  },
  setItem: () => {
    throw new Error('quota exceeded')
  },
}

describe('loadDocument', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(loadDocument(createFakeStorage(), 'sample')).toBe('sample')
  })

  it('returns the stored text', () => {
    const storage = createFakeStorage({ [DOCUMENT_STORAGE_KEY]: '# Saved' })
    expect(loadDocument(storage, 'sample')).toBe('# Saved')
  })

  it('keeps an empty stored document instead of restoring the fallback', () => {
    const storage = createFakeStorage({ [DOCUMENT_STORAGE_KEY]: '' })
    expect(loadDocument(storage, 'sample')).toBe('')
  })

  it('returns the fallback when storage throws', () => {
    expect(loadDocument(throwingStorage, 'sample')).toBe('sample')
  })

  it('returns the fallback when storage is unavailable', () => {
    expect(loadDocument(null, 'sample')).toBe('sample')
  })
})

describe('saveDocument', () => {
  it('stores only the document string under a single key', () => {
    const storage = createFakeStorage()
    expect(saveDocument(storage, '# Hello')).toBe(true)
    expect(storage.entries()).toEqual({ [DOCUMENT_STORAGE_KEY]: '# Hello' })
  })

  it('round-trips through loadDocument', () => {
    const storage = createFakeStorage()
    saveDocument(storage, 'first')
    saveDocument(storage, 'second')
    expect(loadDocument(storage, 'sample')).toBe('second')
  })

  it('reports failure without throwing when storage throws', () => {
    expect(saveDocument(throwingStorage, 'text')).toBe(false)
  })

  it('reports failure when storage is unavailable', () => {
    expect(saveDocument(null, 'text')).toBe(false)
  })
})
