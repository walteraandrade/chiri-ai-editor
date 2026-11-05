import { describe, expect, it } from 'vitest'
import {
  clearLastFile,
  LAST_FILE_KEY,
  loadLastFile,
  saveLastFile,
} from './electron-storage'

const createFakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    entries: () => Object.fromEntries(data),
  }
}

const brokenStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('last file', () => {
  it('remembers the path', () => {
    const storage = createFakeStorage()
    saveLastFile(storage, '/skills/a/SKILL.md')
    expect(storage.entries()[LAST_FILE_KEY]).toBe('/skills/a/SKILL.md')
    expect(loadLastFile(storage)).toBe('/skills/a/SKILL.md')
  })

  it('forgets the path', () => {
    const storage = createFakeStorage()
    saveLastFile(storage, '/skills/a/SKILL.md')
    clearLastFile(storage)
    expect(loadLastFile(storage)).toBeNull()
    expect(storage.entries()[LAST_FILE_KEY]).toBeUndefined()
  })

  it('finds nothing before one was saved', () => {
    expect(loadLastFile(createFakeStorage())).toBeNull()
  })

  it('finds nothing in storage that throws or is missing', () => {
    expect(loadLastFile(brokenStorage)).toBeNull()
    expect(loadLastFile(null)).toBeNull()
    expect(() => saveLastFile(brokenStorage, '/a.md')).not.toThrow()
    expect(() => saveLastFile(null, '/a.md')).not.toThrow()
    expect(() => clearLastFile(brokenStorage)).not.toThrow()
    expect(() => clearLastFile(null)).not.toThrow()
  })
})
