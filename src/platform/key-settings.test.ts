import { describe, expect, it, vi } from 'vitest'
import type { ChiriApi, KeyState } from '../../electron/api'
import { withKeySettings } from './key-settings'
import type { PlatformKit } from './kit'

const state = (overrides: Partial<KeyState> = {}): KeyState => ({
  managed: true,
  present: false,
  storage: 'none',
  keyringAvailable: true,
  backend: 'gnome_libsecret',
  unreadable: false,
  ...overrides,
})

const baseKit = {
  unsavedText: { initial: '', changed: () => undefined },
  history: {},
  keyStatus: { present: true },
} as unknown as PlatformKit

const api = (initial: KeyState): ChiriApi => ({
  shellInfo: vi.fn(),
  keyState: vi.fn(async () => initial),
  saveKey: vi.fn(async () => state({ present: true, storage: 'keyring' })),
  keepKeyAsPlainText: vi.fn(async () =>
    state({ present: true, storage: 'plain-text' }),
  ),
  clearKey: vi.fn(async () => state()),
})

describe('withKeySettings', () => {
  it('reads the key status from the main process when it holds the key', async () => {
    const kit = await withKeySettings(api(state({ present: false })), baseKit)
    expect(kit.keyStatus.present).toBe(false)
    expect(kit.keySettings?.state.present).toBe(false)
    const present = await withKeySettings(
      api(state({ present: true })),
      baseKit,
    )
    expect(present.keyStatus.present).toBe(true)
  })

  it('keeps the rest of the kit', async () => {
    const kit = await withKeySettings(api(state()), baseKit)
    expect(kit.unsavedText).toBe(baseKit.unsavedText)
    expect(kit.history).toBe(baseKit.history)
  })

  it('leaves the kit alone when the main process does not hold the key', async () => {
    const kit = await withKeySettings(api(state({ managed: false })), baseKit)
    expect(kit).toBe(baseKit)
    expect(kit.keySettings).toBeUndefined()
  })

  it('passes each action to the matching API function', async () => {
    const chiri = api(state())
    const { keySettings } = await withKeySettings(chiri, baseKit)
    expect((await keySettings?.save('sk-or-v1-a'))?.storage).toBe('keyring')
    expect(chiri.saveKey).toHaveBeenCalledWith('sk-or-v1-a')
    expect((await keySettings?.keepAsPlainText())?.storage).toBe('plain-text')
    expect((await keySettings?.clear())?.present).toBe(false)
  })
})
