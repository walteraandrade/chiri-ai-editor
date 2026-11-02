import { describe, expect, it, vi } from 'vitest'
import { announceRootsSaved } from './roots-events'
import type { RootsStore } from './roots-store'

const inner = (overrides: Partial<RootsStore> = {}): RootsStore => ({
  load: async () => ({ kind: 'loaded', roots: ['/a'] }),
  save: vi.fn(async () => undefined),
  ...overrides,
})

describe('announceRootsSaved', () => {
  it('passes loads and saves through to the store', async () => {
    const store = inner()
    const { store: announcing } = announceRootsSaved(store)
    expect(await announcing.load()).toEqual({ kind: 'loaded', roots: ['/a'] })
    await announcing.save(['/a', '/b'])
    expect(store.save).toHaveBeenCalledWith(['/a', '/b'])
  })

  it('tells listeners after a save went through', async () => {
    const listener = vi.fn()
    const { store, subscribe } = announceRootsSaved(inner())
    subscribe(listener)
    await store.save(['/a'])
    expect(listener).toHaveBeenCalledOnce()
  })

  it('stays quiet when the save failed, and passes the failure on', async () => {
    const listener = vi.fn()
    const { store, subscribe } = announceRootsSaved(
      inner({
        save: async () => {
          throw new Error('EACCES')
        },
      }),
    )
    subscribe(listener)
    await expect(store.save(['/a'])).rejects.toThrow('EACCES')
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops telling a listener that unsubscribed', async () => {
    const listener = vi.fn()
    const { store, subscribe } = announceRootsSaved(inner())
    subscribe(listener)()
    await store.save(['/a'])
    expect(listener).not.toHaveBeenCalled()
  })
})
