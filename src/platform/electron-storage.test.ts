import { describe, expect, it, vi } from 'vitest'
import {
  createLocalUnsavedStore,
  LAST_FILE_KEY,
  loadLastFile,
  saveLastFile,
  UNSAVED_KEY_PREFIX,
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

describe('createLocalUnsavedStore', () => {
  it('keeps the text per file, with the text it started from', async () => {
    const storage = createFakeStorage()
    const store = createLocalUnsavedStore(storage)
    store.keep('/skills/a/SKILL.md', { text: '# A, edited\n', base: '# A\n' })
    store.keep('/skills/b/SKILL.md', { text: '# B, edited\n', base: '# B\n' })
    expect(await store.load('/skills/a/SKILL.md')).toEqual({
      text: '# A, edited\n',
      base: '# A\n',
    })
    expect(await store.load('/skills/b/SKILL.md')).toEqual({
      text: '# B, edited\n',
      base: '# B\n',
    })
    expect(
      Object.keys(storage.entries()).every((key) =>
        key.startsWith(UNSAVED_KEY_PREFIX),
      ),
    ).toBe(true)
  })

  it('finds nothing for a file that kept nothing', async () => {
    const store = createLocalUnsavedStore(createFakeStorage())
    expect(await store.load('/skills/a/SKILL.md')).toBeNull()
  })

  it('forgets a file on drop', async () => {
    const store = createLocalUnsavedStore(createFakeStorage())
    store.keep('/a.md', { text: 'x', base: 'y' })
    store.drop('/a.md')
    expect(await store.load('/a.md')).toBeNull()
  })

  it('finds nothing in stored data of the wrong shape', async () => {
    const storage = createFakeStorage({
      [`${UNSAVED_KEY_PREFIX}/a.md`]: '{"text":1,"base":"y"}',
      [`${UNSAVED_KEY_PREFIX}/b.md`]: 'not json',
      [`${UNSAVED_KEY_PREFIX}/c.md`]: '{"text":"x"}',
    })
    const store = createLocalUnsavedStore(storage)
    expect(await store.load('/a.md')).toBeNull()
    expect(await store.load('/b.md')).toBeNull()
    expect(await store.load('/c.md')).toBeNull()
  })

  it('runs the hook after every change that went through', () => {
    const afterWrite = vi.fn()
    const store = createLocalUnsavedStore(createFakeStorage(), afterWrite)
    store.keep('/a.md', { text: 'x', base: 'y' })
    expect(afterWrite).toHaveBeenCalledTimes(1)
    store.drop('/a.md')
    expect(afterWrite).toHaveBeenCalledTimes(2)
  })

  it('survives storage that throws, and runs no hook for a write that failed', async () => {
    const afterWrite = vi.fn()
    const store = createLocalUnsavedStore(brokenStorage, afterWrite)
    expect(() => store.keep('/a.md', { text: 'x', base: 'y' })).not.toThrow()
    expect(() => store.drop('/a.md')).not.toThrow()
    expect(await store.load('/a.md')).toBeNull()
    expect(afterWrite).not.toHaveBeenCalled()
  })

  it('works without storage', async () => {
    const store = createLocalUnsavedStore(null)
    store.keep('/a.md', { text: 'x', base: 'y' })
    store.drop('/a.md')
    expect(await store.load('/a.md')).toBeNull()
  })
})

describe('last file', () => {
  it('remembers the path', () => {
    const storage = createFakeStorage()
    saveLastFile(storage, '/skills/a/SKILL.md')
    expect(storage.entries()[LAST_FILE_KEY]).toBe('/skills/a/SKILL.md')
    expect(loadLastFile(storage)).toBe('/skills/a/SKILL.md')
  })

  it('finds nothing before one was saved', () => {
    expect(loadLastFile(createFakeStorage())).toBeNull()
  })

  it('finds nothing in storage that throws or is missing', () => {
    expect(loadLastFile(brokenStorage)).toBeNull()
    expect(loadLastFile(null)).toBeNull()
    expect(() => saveLastFile(brokenStorage, '/a.md')).not.toThrow()
    expect(() => saveLastFile(null, '/a.md')).not.toThrow()
  })
})
