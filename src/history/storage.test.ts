import { describe, expect, it } from 'vitest'
import {
  loadDocument,
  type StorageLike,
  saveDocument,
} from '../document/storage'
import { recordVersion, startHistory } from './history'
import {
  HISTORY_STORAGE_KEY,
  loadHistory,
  makeRoomFor,
  saveHistory,
} from './storage'
import type { History } from './types'

const createFakeStorage = (
  initial: Record<string, string> = {},
  limit = Number.POSITIVE_INFINITY,
) => {
  const data = new Map(Object.entries(initial))
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > limit) throw new Error('QuotaExceededError')
      data.set(key, value)
    },
  }
  return { storage, read: () => data.get(HISTORY_STORAGE_KEY) }
}

const sample: History = recordVersion(startHistory('one', 1), {
  text: 'two',
  cause: {
    kind: 'accepted',
    changes: [{ origin: 'review', instruction: 'tone', rationale: 'Calmer.' }],
  },
  at: 2,
})

const longHistory = (count: number): History =>
  Array.from({ length: count - 1 }, (_, index) => index + 1).reduce<History>(
    (history, index) =>
      recordVersion(history, {
        text: `${'x'.repeat(100)}${index}`,
        cause: { kind: 'edited' },
        at: index,
      }),
    startHistory(`${'x'.repeat(100)}0`, 0),
  )

describe('loadHistory', () => {
  it('returns null when nothing is stored', () => {
    expect(loadHistory(createFakeStorage().storage)).toBeNull()
  })

  it('reads back what saveHistory stored', () => {
    const { storage } = createFakeStorage()
    saveHistory(storage, sample)
    expect(loadHistory(storage)).toEqual(sample)
  })

  it('returns null for text that is not JSON', () => {
    const { storage } = createFakeStorage({ [HISTORY_STORAGE_KEY]: '{oops' })
    expect(loadHistory(storage)).toBeNull()
  })

  it('returns null for JSON of the wrong shape', () => {
    const { storage } = createFakeStorage({
      [HISTORY_STORAGE_KEY]: JSON.stringify({
        versions: [{ id: 'one', text: 1 }],
      }),
    })
    expect(loadHistory(storage)).toBeNull()
  })

  it('returns null when one Version has an unknown Cause or a bad field', () => {
    const stored = (version: object) =>
      createFakeStorage({
        [HISTORY_STORAGE_KEY]: JSON.stringify({
          versions: [{ id: 1, at: 1, text: 'a', ...version }],
        }),
      }).storage
    expect(loadHistory(stored({ cause: { kind: 'merged' } }))).toBeNull()
    expect(
      loadHistory(stored({ cause: { kind: 'restored', from: 1.5 } })),
    ).toBeNull()
    expect(
      loadHistory(
        stored({
          cause: {
            kind: 'accepted',
            changes: [{ origin: 'chat', instruction: 'x', rationale: 'y' }],
          },
        }),
      ),
    ).toBeNull()
    expect(
      loadHistory(stored({ cause: { kind: 'edited' }, saved: 3 })),
    ).toBeNull()
    expect(
      loadHistory(stored({ cause: { kind: 'edited' }, at: 'noon' })),
    ).toBeNull()
    expect(loadHistory(stored({ cause: { kind: 'edited' } }))).toEqual([
      { id: 1, at: 1, text: 'a', cause: { kind: 'edited' } },
    ])
  })

  it('returns null when storage is missing or throws', () => {
    expect(loadHistory(null)).toBeNull()
    expect(
      loadHistory({
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {},
      }),
    ).toBeNull()
  })
})

describe('saveHistory', () => {
  it('stores every Version when they fit', () => {
    const { storage } = createFakeStorage()
    expect(saveHistory(storage, sample)).toBe(true)
    expect(loadHistory(storage)).toHaveLength(2)
  })

  it('stores the newest 10 when the whole History is refused', () => {
    const history = longHistory(30)
    const { storage } = createFakeStorage({}, 2000)
    expect(saveHistory(storage, history)).toBe(true)
    expect(loadHistory(storage)).toEqual(history.slice(-10))
  })

  it('stores only the newest Version as a last resort', () => {
    const history = longHistory(30)
    const { storage } = createFakeStorage({}, 300)
    expect(saveHistory(storage, history)).toBe(true)
    expect(loadHistory(storage)).toEqual(history.slice(-1))
  })

  it('returns false when nothing fits or there is no storage', () => {
    const { storage } = createFakeStorage({}, 10)
    expect(saveHistory(storage, sample)).toBe(false)
    expect(saveHistory(null, sample)).toBe(false)
  })
})

const createSharedStorage = (limit: number) => {
  const data = new Map<string, string>()
  const usedBesides = (key: string): number =>
    [...data].reduce(
      (total, [other, value]) => (other === key ? total : total + value.length),
      0,
    )
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (usedBesides(key) + value.length > limit)
        throw new Error('QuotaExceededError')
      data.set(key, value)
    },
  }
  return storage
}

describe('makeRoomFor', () => {
  const history = longHistory(30)

  it('leaves the History alone when the write fits', () => {
    const storage = createSharedStorage(10_000)
    saveHistory(storage, history)
    expect(
      makeRoomFor(storage, history, () => saveDocument(storage, 'doc')),
    ).toBe(true)
    expect(loadHistory(storage)).toEqual(history)
  })

  it('shrinks the stored History until the Document fits', () => {
    const storage = createSharedStorage(5000)
    saveHistory(storage, history)
    const text = 'd'.repeat(1500)
    expect(
      makeRoomFor(storage, history, () => saveDocument(storage, text)),
    ).toBe(true)
    expect(loadDocument(storage, '')).toBe(text)
    expect(loadHistory(storage)).toEqual(history.slice(-10))
  })

  it('keeps only the newest Version when ten do not leave room', () => {
    const storage = createSharedStorage(5000)
    saveHistory(storage, history)
    const text = 'd'.repeat(4000)
    expect(
      makeRoomFor(storage, history, () => saveDocument(storage, text)),
    ).toBe(true)
    expect(loadHistory(storage)).toEqual(history.slice(-1))
  })

  it('empties the stored History as a last resort', () => {
    const storage = createSharedStorage(5000)
    saveHistory(storage, history)
    const text = 'd'.repeat(4900)
    expect(
      makeRoomFor(storage, history, () => saveDocument(storage, text)),
    ).toBe(true)
    expect(loadDocument(storage, '')).toBe(text)
    expect(loadHistory(storage)).toEqual([])
  })

  it('returns false when the write never fits', () => {
    const storage = createSharedStorage(100)
    expect(
      makeRoomFor(storage, history, () =>
        saveDocument(storage, 'd'.repeat(200)),
      ),
    ).toBe(false)
  })
})
