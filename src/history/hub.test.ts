import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSwitchableHistory } from './hub'
import { createLocalHistoryStore } from './local-store'
import { createDocumentHistory, type DocumentHistory } from './session'
import type { HistoryStore } from './store'

const IDLE_MS = 30_000

const createStore = () => {
  const stores = new Map<string, HistoryStore>()
  const at = (key: string): HistoryStore => {
    const known = stores.get(key)
    if (known) return known
    const created = createLocalHistoryStore(null)
    stores.set(key, created)
    return created
  }
  const calls: string[] = []
  const store: HistoryStore = {
    list: (key) => at(key).list(key),
    text: (key, id) => at(key).text(key, id),
    record: (key, input) => {
      calls.push(`${key}:${input.cause.kind}:${input.text}`)
      return at(key).record(key, input)
    },
    markSaved: (key, input) => {
      calls.push(`${key}:saved:${input.text}`)
      return at(key).markSaved(key, input)
    },
  }
  return { store, calls }
}

const create = () => {
  const { store, calls } = createStore()
  const hub = createSwitchableHistory<string>({
    keyOf: (ref) => ref ?? 'scratch',
    create: (key, initial) =>
      createDocumentHistory({
        store,
        key,
        initial,
        now: () => 1000,
        idleMs: IDLE_MS,
        onError: vi.fn(),
      }),
    first: { ref: null, initial: [] },
  })
  return { hub, calls, store }
}

describe('createSwitchableHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes to the key of the file it started with', async () => {
    const { hub, calls } = create()
    hub.opened({ text: 'first', name: 'a.md' })
    await hub.settled()
    expect(calls).toEqual(['scratch:opened:first'])
  })

  it('moves writes to the key of the file it switches to', async () => {
    const { hub, calls } = create()
    hub.select('/notes/a.md')
    hub.opened({ text: 'in a', name: 'a.md' })
    await hub.settled()
    expect(calls).toEqual(['/notes/a.md:opened:in a'])
  })

  it('records pending edits under the old key before the new key gets anything', async () => {
    const { hub, calls } = create()
    hub.edited('typed in scratch')
    hub.select('/notes/a.md')
    hub.opened({ text: 'a text', name: 'a.md' })
    await hub.settled()
    expect(calls).toEqual([
      'scratch:edited:typed in scratch',
      '/notes/a.md:opened:a text',
    ])
  })

  it('does not record pending edits of the old file a second time later', async () => {
    const { hub, calls } = create()
    hub.edited('pending')
    hub.select('/notes/a.md')
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2)
    await hub.settled()
    expect(calls).toEqual(['scratch:edited:pending'])
  })

  it('shows the Timeline of the file it is on', async () => {
    const { hub } = create()
    hub.opened({ text: 'one', name: 'a.md' })
    await hub.settled()
    hub.select('/notes/a.md')
    expect(hub.snapshot()).toEqual([])
    hub.opened({ text: 'two words', name: 'a.md' })
    hub.opened({ text: 'two words more', name: 'a.md' })
    await hub.settled()
    expect(hub.snapshot().map(({ words }) => words)).toEqual([2, 3])
    hub.select(null)
    await hub.settled()
    expect(hub.snapshot().map(({ words }) => words)).toEqual([1])
  })

  it('loads the Versions of a file it comes back to', async () => {
    const { hub } = create()
    hub.select('/notes/a.md')
    hub.opened({ text: 'alpha', name: 'a.md' })
    await hub.settled()
    hub.select('/notes/b.md')
    await hub.settled()
    expect(hub.snapshot()).toEqual([])
    hub.select('/notes/a.md')
    await hub.settled()
    expect(hub.snapshot()).toHaveLength(1)
  })

  it('starts from the Versions it was given for the first file', () => {
    const { store } = createStore()
    const initial = [
      {
        id: 1,
        at: 1,
        cause: { kind: 'started' },
        words: 1,
        wordsAdded: 1,
        wordsRemoved: 0,
      },
    ] as const
    const hub = createSwitchableHistory<string>({
      keyOf: (ref) => ref ?? 'scratch',
      create: (key, versions) =>
        createDocumentHistory({
          store,
          key,
          initial: versions,
          now: () => 1,
          idleMs: IDLE_MS,
          onError: vi.fn(),
        }),
      first: { ref: null, initial },
    })
    expect(hub.snapshot()).toBe(initial)
  })

  it('tells subscribers when it switches, and when the new list arrives', async () => {
    const { hub } = create()
    const listener = vi.fn()
    hub.subscribe(listener)
    hub.select('/notes/a.md')
    expect(listener).toHaveBeenCalledTimes(1)
    hub.opened({ text: 'text', name: 'a.md' })
    await hub.settled()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stops telling subscribers who unsubscribed', async () => {
    const { hub } = create()
    const listener = vi.fn()
    const unsubscribe = hub.subscribe(listener)
    unsubscribe()
    hub.select('/notes/a.md')
    hub.opened({ text: 'text', name: 'a.md' })
    await hub.settled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('does nothing when it selects the file it is on', async () => {
    const { hub, calls } = create()
    hub.edited('still pending')
    const listener = vi.fn()
    hub.subscribe(listener)
    hub.select(null)
    expect(listener).not.toHaveBeenCalled()
    expect(calls).toEqual([])
    hub.flush()
    await hub.settled()
    expect(calls).toEqual(['scratch:edited:still pending'])
  })

  it('maps a file without a ref to the same key as the one it started with', () => {
    const { hub, calls } = create()
    hub.select('/notes/a.md')
    hub.select(null)
    hub.opened({ text: 'back', name: 'x.md' })
    expect(calls).toEqual(['scratch:opened:back'])
  })

  it('loads the text of a Version of the file it is on', async () => {
    const { hub } = create()
    hub.select('/notes/a.md')
    hub.opened({ text: 'the text', name: 'a.md' })
    await hub.settled()
    const [version] = hub.snapshot()
    expect(version && (await hub.text(version.id))).toBe('the text')
  })

  it('flushes the pending edits of the file it is on', async () => {
    const { hub, calls } = create()
    hub.select('/notes/a.md')
    hub.edited('unsaved typing')
    hub.flush()
    await hub.settled()
    expect(calls).toEqual(['/notes/a.md:edited:unsaved typing'])
  })

  it('stops tracking a file it left once its writes settled', async () => {
    const { store } = createStore()
    const made: DocumentHistory[] = []
    const hub = createSwitchableHistory<string>({
      keyOf: (ref) => ref ?? 'scratch',
      create: (key, initial) => {
        const history = createDocumentHistory({
          store,
          key,
          initial,
          now: () => 1,
          idleMs: IDLE_MS,
          onError: vi.fn(),
        })
        made.push(history)
        return history
      },
      first: { ref: null, initial: [] },
    })
    const first = made[0]
    if (first === undefined) throw new Error('no first history')
    const settled = vi.spyOn(first, 'settled')
    hub.opened({ text: 'left behind', name: 'a.md' })
    hub.select('/notes/a.md')
    await vi.advanceTimersByTimeAsync(0)
    settled.mockClear()
    await hub.settled()
    expect(settled).not.toHaveBeenCalled()
  })

  it('keeps waiting for a file it left while its writes are pending', async () => {
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const { store } = createStore()
    const slow: HistoryStore = {
      ...store,
      record: async (key, input) => {
        if (key === 'scratch') await held
        return store.record(key, input)
      },
    }
    const made: DocumentHistory[] = []
    const hub = createSwitchableHistory<string>({
      keyOf: (ref) => ref ?? 'scratch',
      create: (key, initial) => {
        const history = createDocumentHistory({
          store: slow,
          key,
          initial,
          now: () => 1,
          idleMs: IDLE_MS,
          onError: vi.fn(),
        })
        made.push(history)
        return history
      },
      first: { ref: null, initial: [] },
    })
    const first = made[0]
    if (first === undefined) throw new Error('no first history')
    const settled = vi.spyOn(first, 'settled')
    hub.opened({ text: 'slow', name: 'a.md' })
    hub.select('/notes/a.md')
    await vi.advanceTimersByTimeAsync(0)
    settled.mockClear()
    const waiting = hub.settled()
    expect(settled).toHaveBeenCalledTimes(1)
    release()
    await waiting
    settled.mockClear()
    await hub.settled()
    expect(settled).not.toHaveBeenCalled()
  })

  it('waits for the writes of the file it left', async () => {
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const { store } = createStore()
    const slow: HistoryStore = {
      ...store,
      record: async (key, input) => {
        if (key === 'scratch') await held
        return store.record(key, input)
      },
    }
    const hub = createSwitchableHistory<string>({
      keyOf: (ref) => ref ?? 'scratch',
      create: (key, initial) =>
        createDocumentHistory({
          store: slow,
          key,
          initial,
          now: () => 1,
          idleMs: IDLE_MS,
          onError: vi.fn(),
        }),
      first: { ref: null, initial: [] },
    })
    hub.opened({ text: 'slow', name: 'a.md' })
    hub.select('/notes/a.md')
    let settled = false
    void hub.settled().then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    release()
    await hub.settled()
    expect(settled).toBe(true)
  })
})
