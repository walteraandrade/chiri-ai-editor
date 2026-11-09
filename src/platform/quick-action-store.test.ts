import { describe, expect, it } from 'vitest'
import {
  addUserQuickAction,
  DEFAULT_QUICK_ACTION_SETTINGS,
  serializeQuickActionSettings,
} from '../ai/quick-action-settings'
import {
  createQuickActionStore,
  localQuickActionStore,
  QUICK_ACTIONS_STORAGE_KEY,
} from './quick-action-store'

const SETTINGS = addUserQuickAction(
  DEFAULT_QUICK_ACTION_SETTINGS,
  { label: 'Warmer', instruction: 'Make it warm.', skillOnly: false },
  'user-1',
)

const memoryStorage = () => {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
  }
}

describe('createQuickActionStore', () => {
  it('falls back to the defaults when nothing is stored', async () => {
    const store = createQuickActionStore({
      read: async () => null,
      write: async () => undefined,
    })
    expect(await store.load()).toEqual(DEFAULT_QUICK_ACTION_SETTINGS)
  })

  it('falls back to the defaults when the stored text is unreadable or the read fails', async () => {
    const garbage = createQuickActionStore({
      read: async () => 'garbage',
      write: async () => undefined,
    })
    const failing = createQuickActionStore({
      read: async () => {
        throw new Error('disk')
      },
      write: async () => undefined,
    })
    expect(await garbage.load()).toEqual(DEFAULT_QUICK_ACTION_SETTINGS)
    expect(await failing.load()).toEqual(DEFAULT_QUICK_ACTION_SETTINGS)
  })

  it('writes the serialized settings', async () => {
    const written: string[] = []
    const store = createQuickActionStore({
      read: async () => null,
      write: async (text) => {
        written.push(text)
      },
    })
    await store.save(SETTINGS)
    expect(written).toEqual([serializeQuickActionSettings(SETTINGS)])
  })
})

describe('localQuickActionStore', () => {
  it('keeps the settings under desafinado.quickActions', async () => {
    const storage = memoryStorage()
    await localQuickActionStore(storage).save(SETTINGS)
    expect(storage.items.has(QUICK_ACTIONS_STORAGE_KEY)).toBe(true)
    expect(await localQuickActionStore(storage).load()).toEqual(SETTINGS)
  })

  it('fails to save without storage', async () => {
    await expect(localQuickActionStore(null).save(SETTINGS)).rejects.toThrow()
  })
})
