import { describe, expect, it } from 'vitest'
import {
  loadDocument,
  type StorageLike,
  saveDocument,
} from '../document/storage'
import { MAX_VERSIONS } from './history'
import { createLocalHistoryStore } from './local-store'
import { HISTORY_STORAGE_KEY, loadHistory } from './storage'
import { describeHistoryStoreContract } from './store-contract'

const KEY = 'document'

const createFakeStorage = (limit = Number.POSITIVE_INFINITY) => {
  const data = new Map<string, string>()
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > limit) throw new Error('QuotaExceededError')
      data.set(key, value)
    },
  }
  return { storage, data }
}

const createSharedQuotaStorage = (limit: number): StorageLike => {
  const data = new Map<string, string>()
  const usedBesides = (key: string): number =>
    [...data].reduce(
      (total, [other, value]) => (other === key ? total : total + value.length),
      0,
    )
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (usedBesides(key) + value.length > limit)
        throw new Error('QuotaExceededError')
      data.set(key, value)
    },
  }
}

describeHistoryStoreContract(
  'the localStorage adapter',
  async () => ({
    store: createLocalHistoryStore(createFakeStorage().storage),
    dispose: () => undefined,
  }),
  { cap: MAX_VERSIONS, perFile: false },
)

const edit = (text: string, at = 1) => ({
  at,
  cause: { kind: 'edited' } as const,
  text,
})

describe('createLocalHistoryStore', () => {
  it('keeps the History across reloads', async () => {
    const { storage } = createFakeStorage()
    const first = createLocalHistoryStore(storage)
    await first.record(KEY, edit('one'))
    await first.record(KEY, edit('two', 2))
    const reloaded = createLocalHistoryStore(storage)
    const versions = await reloaded.list(KEY)
    expect(versions.map(({ words }) => words)).toEqual([1, 1])
    const last = versions.at(-1)
    expect(last && (await reloaded.text(KEY, last.id))).toBe('two')
  })

  it('writes to localStorage before the call returns', () => {
    const { storage, data } = createFakeStorage()
    const store = createLocalHistoryStore(storage)
    void store.record(KEY, edit('now'))
    expect(data.get(HISTORY_STORAGE_KEY)).toContain('now')
  })

  it('reads a History stored without word counts and works them out', async () => {
    const { storage, data } = createFakeStorage()
    data.set(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        versions: [
          { id: 7, at: 1, cause: { kind: 'started' }, text: 'old text' },
          { id: 8, at: 2, cause: { kind: 'edited' }, text: 'old new text now' },
        ],
      }),
    )
    const versions = await createLocalHistoryStore(storage).list(KEY)
    expect(versions).toEqual([
      {
        id: 7,
        at: 1,
        cause: { kind: 'started' },
        words: 2,
        wordsAdded: 2,
        wordsRemoved: 0,
      },
      {
        id: 8,
        at: 2,
        cause: { kind: 'edited' },
        words: 4,
        wordsAdded: 2,
        wordsRemoved: 0,
      },
    ])
  })

  it('stores the word counts with each Version', async () => {
    const { storage, data } = createFakeStorage()
    const store = createLocalHistoryStore(storage)
    await store.record(KEY, edit('one two'))
    await store.record(KEY, edit('one 2 three', 2))
    const stored = loadHistory(storage)
    expect(
      stored?.map(({ wordsAdded, wordsRemoved }) => [wordsAdded, wordsRemoved]),
    ).toEqual([
      [2, 0],
      [2, 1],
    ])
    expect(data.get(HISTORY_STORAGE_KEY)).toContain('"wordsAdded":2')
  })

  it('keeps the counts of the oldest Version after the Versions before it are dropped', async () => {
    const { storage } = createFakeStorage()
    const store = createLocalHistoryStore(storage)
    for (let index = 0; index <= MAX_VERSIONS; index += 1)
      await store.record(KEY, edit(`word${index} stays here`, index))
    const [oldest] = await createLocalHistoryStore(storage).list(KEY)
    expect(oldest).toMatchObject({ wordsAdded: 1, wordsRemoved: 1 })
  })

  it('starts fresh from stored data that does not parse', async () => {
    const { storage, data } = createFakeStorage()
    data.set(HISTORY_STORAGE_KEY, '{oops')
    expect(await createLocalHistoryStore(storage).list(KEY)).toEqual([])
  })

  it('works without storage, keeping the session in memory', async () => {
    const store = createLocalHistoryStore(null)
    await store.record(KEY, edit('a'))
    await store.record(KEY, edit('b', 2))
    expect(await store.list(KEY)).toHaveLength(2)
  })

  it('stores the newest 10 Versions when the whole History is refused', async () => {
    const { storage } = createFakeStorage(2500)
    const store = createLocalHistoryStore(storage)
    for (let index = 0; index < 30; index += 1)
      await store.record(KEY, edit(`${'x'.repeat(100)}${index}`, index))
    expect(await store.list(KEY)).toHaveLength(30)
    expect(loadHistory(storage)).toHaveLength(10)
  })

  it('stores only the newest Version as a last resort', async () => {
    const { storage } = createFakeStorage(300)
    const store = createLocalHistoryStore(storage)
    for (let index = 0; index < 5; index += 1)
      await store.record(KEY, edit(`${'x'.repeat(100)}${index}`, index))
    expect(loadHistory(storage)).toHaveLength(1)
    expect(await store.list(KEY)).toHaveLength(5)
  })

  it('shrinks the stored History to let a Document write through', async () => {
    const storage = createSharedQuotaStorage(4000)
    const store = createLocalHistoryStore(storage)
    for (let index = 0; index < 30; index += 1)
      await store.record(KEY, edit(`${'x'.repeat(100)}${index}`, index))
    const text = 'd'.repeat(3900)
    expect(store.makeRoomFor(() => saveDocument(storage, text))).toBe(true)
    expect(loadDocument(storage, '')).toBe(text)
    expect(loadHistory(storage)).toEqual([])
    expect(await store.list(KEY)).toHaveLength(30)
  })
})
