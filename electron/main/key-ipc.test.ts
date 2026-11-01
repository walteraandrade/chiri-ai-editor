import { describe, expect, it } from 'vitest'
import {
  KEY_CLEAR_CHANNEL,
  KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
  KEY_SAVE_CHANNEL,
  KEY_STATE_CHANNEL,
  type KeyDetails,
} from '../api'
import { registerKeyIpc } from './key-ipc'
import type { KeyStore } from './key-store'

const KEY = 'sk-or-v1-dummy-for-tests'

const details = (overrides: Partial<KeyDetails> = {}): KeyDetails => ({
  present: false,
  storage: 'none',
  keyringAvailable: true,
  backend: 'gnome_libsecret',
  unreadable: false,
  ...overrides,
})

const fakeStore = () => {
  const calls: string[] = []
  const store: KeyStore = {
    load: async () => details(),
    status: () => details(),
    current: () => undefined,
    save: async (key) => {
      calls.push(`save:${key}`)
      return details({ present: true, storage: 'keyring' })
    },
    keepAsPlainText: async () => {
      calls.push('plain')
      return details({ present: true, storage: 'plain-text' })
    },
    clear: async () => {
      calls.push('clear')
      return details()
    },
  }
  return { store, calls }
}

type Handler = (event: unknown, ...args: unknown[]) => unknown

const setup = (managed = true) => {
  const handlers = new Map<string, Handler>()
  const { store, calls } = fakeStore()
  registerKeyIpc({
    ipc: { handle: (channel, handler) => handlers.set(channel, handler) },
    store,
    managed,
    isTrusted: (event) => (event as { trusted?: boolean }).trusted === true,
  })
  const call = async (channel: string, event: unknown, ...args: unknown[]) =>
    handlers.get(channel)?.(event, ...args)
  return { call, calls, handlers }
}

const TRUSTED = { trusted: true }
const UNTRUSTED = { trusted: false }

describe('registerKeyIpc', () => {
  it('registers one handler per action', () => {
    const { handlers } = setup()
    expect([...handlers.keys()].sort()).toEqual(
      [
        KEY_CLEAR_CHANNEL,
        KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
        KEY_SAVE_CHANNEL,
        KEY_STATE_CHANNEL,
      ].sort(),
    )
  })

  it('reports the state with the managed flag', async () => {
    const managed = await setup(true).call(KEY_STATE_CHANNEL, TRUSTED)
    expect(managed).toMatchObject({ managed: true, present: false })
    const dev = await setup(false).call(KEY_STATE_CHANNEL, TRUSTED)
    expect(dev).toMatchObject({ managed: false })
  })

  it('saves a validated key and returns the state without it', async () => {
    const { call, calls } = setup()
    const state = await call(KEY_SAVE_CHANNEL, TRUSTED, `  ${KEY}\n`)
    expect(calls).toEqual([`save:${KEY}`])
    expect(state).toMatchObject({ managed: true, present: true })
    expect(JSON.stringify(state)).not.toContain(KEY)
  })

  it('keeps as plain text and clears', async () => {
    const { call, calls } = setup()
    expect(await call(KEY_KEEP_AS_PLAIN_TEXT_CHANNEL, TRUSTED)).toMatchObject({
      storage: 'plain-text',
    })
    expect(await call(KEY_CLEAR_CHANNEL, TRUSTED)).toMatchObject({
      present: false,
    })
    expect(calls).toEqual(['plain', 'clear'])
  })

  it('refuses every action from an untrusted frame', async () => {
    const { call, calls } = setup()
    for (const channel of [
      KEY_STATE_CHANNEL,
      KEY_SAVE_CHANNEL,
      KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
      KEY_CLEAR_CHANNEL,
    ])
      await expect(call(channel, UNTRUSTED, KEY)).rejects.toThrow(
        'Untrusted sender',
      )
    expect(calls).toEqual([])
  })

  it('rejects an invalid key without echoing it', async () => {
    const { call, calls } = setup()
    for (const value of [
      undefined,
      42,
      '',
      'has space',
      'with space secret',
      { key: KEY },
    ])
      await expect(call(KEY_SAVE_CHANNEL, TRUSTED, value)).rejects.toThrow(
        /^Invalid key$/,
      )
    expect(calls).toEqual([])
  })

  it('refuses to change the key where the main process does not hold it', async () => {
    const { call, calls } = setup(false)
    for (const channel of [
      KEY_SAVE_CHANNEL,
      KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
      KEY_CLEAR_CHANNEL,
    ])
      await expect(call(channel, TRUSTED, KEY)).rejects.toThrow(
        'Key settings are not available in this run',
      )
    expect(calls).toEqual([])
  })
})
