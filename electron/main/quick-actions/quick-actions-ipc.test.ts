import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addUserQuickAction,
  DEFAULT_QUICK_ACTION_SETTINGS,
  serializeQuickActionSettings,
} from '../../../src/ai/quick-action-settings'
import {
  QUICK_ACTIONS_LOAD_CHANNEL,
  QUICK_ACTIONS_SAVE_CHANNEL,
} from '../../api'
import {
  QUICK_ACTIONS_FILE_NAME,
  registerQuickActionsIpc,
} from './quick-actions-ipc'

type Handler = (event: unknown, ...args: unknown[]) => unknown

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'desafinado-quick-actions-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const setup = (trusted = true) => {
  const handlers = new Map<string, Handler>()
  registerQuickActionsIpc({
    ipc: { handle: (channel, handler) => handlers.set(channel, handler) },
    userDataDir: dir,
    isTrusted: () => trusted,
  })
  const call = (channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args))
  return { call }
}

const SETTINGS = addUserQuickAction(
  DEFAULT_QUICK_ACTION_SETTINGS,
  { label: 'Warmer', instruction: 'Make it warm.', skillOnly: false },
  'user-1',
)

const file = () => join(dir, QUICK_ACTIONS_FILE_NAME)

describe('registerQuickActionsIpc', () => {
  it('has nothing to load before anything is saved', async () => {
    expect(await setup().call(QUICK_ACTIONS_LOAD_CHANNEL)).toBeNull()
  })

  it('keeps the settings in a file in the user data folder', async () => {
    const { call } = setup()
    await call(
      QUICK_ACTIONS_SAVE_CHANNEL,
      serializeQuickActionSettings(SETTINGS),
    )
    expect(await readFile(file(), 'utf8')).toBe(
      serializeQuickActionSettings(SETTINGS),
    )
    expect(await setup().call(QUICK_ACTIONS_LOAD_CHANNEL)).toBe(
      serializeQuickActionSettings(SETTINGS),
    )
  })

  it('writes the settings it understood, not the text it was sent', async () => {
    const sent = JSON.stringify({
      version: 1,
      actions: [{ id: 'clearer', on: true, label: 'Hacked' }],
      extra: true,
    })
    await setup().call(QUICK_ACTIONS_SAVE_CHANNEL, sent)
    expect(JSON.parse(await readFile(file(), 'utf8')).actions[0]).toEqual({
      id: 'clearer',
      on: true,
    })
  })

  it.each([
    ['not text', 42],
    ['not settings', '{"version":9}'],
    ['too long', 'x'.repeat(300_000)],
  ])('refuses to save what is %s', async (_name, input) => {
    await expect(
      setup().call(QUICK_ACTIONS_SAVE_CHANNEL, input),
    ).rejects.toThrow('Invalid Quick actions')
  })

  it('gives back a file it cannot read as settings, for the app to fall back', async () => {
    await writeFile(file(), 'garbage')
    expect(await setup().call(QUICK_ACTIONS_LOAD_CHANNEL)).toBe('garbage')
  })

  it('answers only the app', async () => {
    const { call } = setup(false)
    await expect(call(QUICK_ACTIONS_LOAD_CHANNEL)).rejects.toThrow(
      'Untrusted sender',
    )
    await expect(
      call(QUICK_ACTIONS_SAVE_CHANNEL, serializeQuickActionSettings(SETTINGS)),
    ).rejects.toThrow('Untrusted sender')
  })
})
