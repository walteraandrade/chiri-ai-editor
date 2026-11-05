import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalHistoryStore } from './local-store'
import { createDocumentHistory } from './session'
import type { HistoryStore } from './store'

const KEY = 'document'
const IDLE_MS = 30_000

const create = (
  store: HistoryStore = createLocalHistoryStore(null),
  overrides: { readonly cacheSize?: number } = {},
) => {
  const onError = vi.fn()
  const history = createDocumentHistory({
    store,
    key: KEY,
    initial: [],
    now: () => 1000,
    idleMs: IDLE_MS,
    onError,
    ...overrides,
  })
  return { history, onError }
}

const deferred = () => {
  let release: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('createDocumentHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts from the Versions it was given', () => {
    const initial = [
      {
        id: 1,
        at: 1,
        cause: { kind: 'started' },
        words: 2,
        wordsAdded: 2,
        wordsRemoved: 0,
      },
    ] as const
    const history = createDocumentHistory({
      store: createLocalHistoryStore(null),
      key: KEY,
      initial,
      now: () => 1,
      idleMs: IDLE_MS,
      onError: vi.fn(),
    })
    expect(history.snapshot()).toBe(initial)
  })

  it('lists a recorded Version once the store has it', async () => {
    const { history } = create()
    history.opened({ text: 'one two', name: 'a.md' })
    await history.settled()
    expect(history.snapshot()).toMatchObject([
      { cause: { kind: 'started' }, words: 2 },
    ])
  })

  it('notifies subscribers once per change, until they unsubscribe', async () => {
    const { history } = create()
    const listener = vi.fn()
    const unsubscribe = history.subscribe(listener)
    history.opened({ text: 'a', name: 'a.md' })
    history.opened({ text: 'b', name: 'b.md' })
    await history.settled()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    history.opened({ text: 'c', name: 'c.md' })
    await history.settled()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(history.snapshot()).toHaveLength(3)
  })

  it('keeps the snapshot and stays quiet when the store skipped a write', async () => {
    const { history } = create()
    history.opened({ text: 'same', name: 'a.md' })
    await history.settled()
    const before = history.snapshot()
    const listener = vi.fn()
    history.subscribe(listener)
    history.opened({ text: 'same', name: 'a.md' })
    await history.settled()
    expect(history.snapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('shows a saved mark in the snapshot', async () => {
    const { history } = create()
    history.opened({ text: 'text', name: 'a.md' })
    history.saving('text')
    history.saved({ text: 'text', name: 'a.md' })
    await history.settled()
    expect(history.snapshot().map(({ saved }) => saved)).toEqual(['a.md'])
  })

  it('sends every write to the store before the call returns, without waiting for the one before', () => {
    const gate = deferred()
    const seen: string[] = []
    const store: HistoryStore = {
      ...createLocalHistoryStore(null),
      record: async (_key, { text }) => {
        seen.push(text)
        await gate.promise
      },
    }
    const { history } = create(store)
    history.opened({ text: 'first', name: 'a.md' })
    history.opened({ text: 'second', name: 'b.md' })
    expect(seen).toEqual(['first', 'second'])
  })

  it('sends a flush right after an Accept to the store at once', () => {
    const gate = deferred()
    const seen: string[] = []
    const store: HistoryStore = {
      ...createLocalHistoryStore(null),
      record: async (_key, { text }) => {
        seen.push(text)
        await gate.promise
      },
    }
    const { history } = create(store)
    history.accepted({ before: 'a', text: 'b', changes: [] })
    history.edited('typed after')
    history.flush()
    expect(seen).toEqual(['a', 'b', 'typed after'])
  })

  it('does not hold a write back for an earlier one that is slow', async () => {
    const gate = deferred()
    const seen: string[] = []
    const local = createLocalHistoryStore(null)
    const store: HistoryStore = {
      ...local,
      record: async (key, input) => {
        seen.push(`start ${input.text}`)
        if (input.text === 'first') await gate.promise
        await local.record(key, input)
        seen.push(`end ${input.text}`)
      },
    }
    const { history } = create(store)
    history.opened({ text: 'first', name: 'a.md' })
    history.opened({ text: 'second', name: 'b.md' })
    expect(seen).toEqual(['start first', 'start second'])
    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toEqual(['start first', 'start second', 'end second'])
    gate.release()
    await history.settled()
    expect(seen.at(-1)).toBe('end first')
  })

  it('lists the Versions once after a burst of writes', async () => {
    const local = createLocalHistoryStore(null)
    const list = vi.fn(local.list)
    const { history } = create({ ...local, list })
    for (const text of ['a', 'b', 'c'])
      history.opened({ text, name: `${text}.md` })
    await history.settled()
    expect(list).toHaveBeenCalledTimes(1)
    expect(history.snapshot()).toHaveLength(3)
  })

  it('lists again for a write made while the list is being read', async () => {
    const local = createLocalHistoryStore(null)
    const gate = deferred()
    let slow = true
    const store: HistoryStore = {
      ...local,
      list: async (key) => {
        const listed = await local.list(key)
        if (slow) {
          slow = false
          await gate.promise
        }
        return listed
      },
    }
    const { history } = create(store)
    history.opened({ text: 'a', name: 'a.md' })
    await vi.advanceTimersByTimeAsync(0)
    history.opened({ text: 'b', name: 'b.md' })
    gate.release()
    await history.settled()
    expect(history.snapshot()).toHaveLength(2)
  })

  it('lists the Versions of a History it was not given any for', async () => {
    const local = createLocalHistoryStore(null)
    await local.record(KEY, { at: 1, cause: { kind: 'edited' }, text: 'old' })
    const history = createDocumentHistory({
      store: local,
      key: KEY,
      now: () => 1,
      idleMs: IDLE_MS,
      onError: vi.fn(),
    })
    expect(history.snapshot()).toEqual([])
    await history.settled()
    expect(history.snapshot()).toHaveLength(1)
  })

  it('lists again for writes made right after it started listing', async () => {
    const history = createDocumentHistory({
      store: createLocalHistoryStore(null),
      key: KEY,
      now: () => 1,
      idleMs: IDLE_MS,
      onError: vi.fn(),
    })
    history.opened({ text: 'two words', name: 'a.md' })
    history.opened({ text: 'two words more', name: 'a.md' })
    await history.settled()
    expect(history.snapshot()).toHaveLength(2)
  })

  it('tells when a write went through, and not when it failed', async () => {
    const local = createLocalHistoryStore(null)
    const onWritten = vi.fn()
    const store: HistoryStore = {
      ...local,
      record: async (key, input) => {
        if (input.text === 'bad') throw new Error('disk full')
        return local.record(key, input)
      },
    }
    const history = createDocumentHistory({
      store,
      key: KEY,
      initial: [],
      now: () => 1,
      idleMs: IDLE_MS,
      onError: vi.fn(),
      onWritten,
    })
    history.opened({ text: 'bad', name: 'a.md' })
    await history.settled()
    expect(onWritten).not.toHaveBeenCalled()
    history.opened({ text: 'good', name: 'b.md' })
    await history.settled()
    expect(onWritten).toHaveBeenCalledTimes(1)
  })

  it('reports a failed write and carries on with the next one', async () => {
    const failure = new Error('disk full')
    const local = createLocalHistoryStore(null)
    const store: HistoryStore = {
      ...local,
      record: async (key, input) => {
        if (input.text === 'bad') throw failure
        return local.record(key, input)
      },
    }
    const { history, onError } = create(store)
    history.opened({ text: 'bad', name: 'a.md' })
    history.opened({ text: 'good', name: 'b.md' })
    await history.settled()
    expect(onError).toHaveBeenCalledWith(failure)
    expect(history.snapshot()).toHaveLength(1)
  })

  it('reports a failed listing and keeps the last snapshot', async () => {
    const failure = new Error('gone')
    const store: HistoryStore = {
      ...createLocalHistoryStore(null),
      list: () => Promise.reject(failure),
    }
    const { history, onError } = create(store)
    history.opened({ text: 'a', name: 'a.md' })
    await history.settled()
    expect(onError).toHaveBeenCalledWith(failure)
    expect(history.snapshot()).toEqual([])
  })

  it('records pending edits when flushed', async () => {
    const { history } = create()
    history.opened({ text: 'a', name: 'a.md' })
    history.edited('a b')
    history.flush()
    await history.settled()
    expect(history.snapshot().map(({ words }) => words)).toEqual([1, 2])
  })

  describe('text', () => {
    const withTexts = () => {
      const local = createLocalHistoryStore(null)
      const text = vi.fn(local.text)
      return { store: { ...local, text } satisfies HistoryStore, text }
    }

    it('loads a Version text through the store', async () => {
      const { store } = withTexts()
      const { history } = create(store)
      history.opened({ text: 'loaded text', name: 'a.md' })
      await history.settled()
      const [version] = history.snapshot()
      expect(version && (await history.text(version.id))).toBe('loaded text')
    })

    it('loads a text once, however often it is asked for', async () => {
      const { store, text } = withTexts()
      const { history } = create(store)
      history.opened({ text: 'a', name: 'a.md' })
      await history.settled()
      const [version] = history.snapshot()
      const id = version?.id ?? -1
      await Promise.all([history.text(id), history.text(id)])
      await history.text(id)
      expect(text).toHaveBeenCalledTimes(1)
    })

    it('does not remember a Version that has no text', async () => {
      const { store, text } = withTexts()
      const { history } = create(store)
      expect(await history.text(404)).toBeNull()
      expect(await history.text(404)).toBeNull()
      expect(text).toHaveBeenCalledTimes(2)
    })

    it('forgets the oldest loaded text past its cache size', async () => {
      const { store, text } = withTexts()
      const { history } = create(store, { cacheSize: 2 })
      for (const label of ['a', 'b', 'c'])
        history.opened({ text: label, name: `${label}.md` })
      await history.settled()
      const ids = history.snapshot().map(({ id }) => id)
      for (const id of ids) await history.text(id)
      expect(text).toHaveBeenCalledTimes(3)
      await history.text(ids[2] ?? -1)
      await history.text(ids[0] ?? -1)
      expect(text).toHaveBeenCalledTimes(4)
    })
  })
})
