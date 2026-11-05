import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_CHANNELS } from '../history-api'
import { registerHistory } from './history-main'

type Listener = (
  event: { readonly senderFrame: { readonly origin: string } | null },
  ...args: unknown[]
) => unknown

const trusted = { senderFrame: { origin: 'app://chiri' } }

describe('registerHistory', () => {
  let directory = ''
  let file = ''

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chiri-main-'))
    file = join(directory, 'history.sqlite')
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  const setup = () => {
    const listeners = new Map<string, Listener>()
    const quit: (() => void)[] = []
    registerHistory({
      ipcMain: {
        handle: (channel, listener) => listeners.set(channel, listener),
      },
      file: () => file,
      isTrusted: (event) => event.senderFrame?.origin === 'app://chiri',
      onQuit: (close) => quit.push(close),
    })
    const call = (channel: string, ...args: unknown[]) =>
      listeners.get(channel)?.(trusted, ...args)
    return { call, quit }
  }

  it('opens the database on the first call, not before', () => {
    const { call } = setup()
    expect(existsSync(file)).toBe(false)
    call(HISTORY_CHANNELS.list, '/a.md')
    expect(existsSync(file)).toBe(true)
  })

  it('keeps what one call wrote for the next', () => {
    const { call } = setup()
    call(HISTORY_CHANNELS.record, '/a.md', {
      at: 1,
      cause: { kind: 'edited' },
      text: 'kept',
    })
    expect(call(HISTORY_CHANNELS.list, '/a.md')).toHaveLength(1)
  })

  it('closes the database when the app quits, and survives a second quit', () => {
    const { call, quit } = setup()
    call(HISTORY_CHANNELS.list, '/a.md')
    expect(quit).toHaveLength(1)
    quit[0]?.()
    expect(() => quit[0]?.()).not.toThrow()
  })

  it('retries opening after a failure', () => {
    file = join(directory, 'missing', 'history.sqlite')
    const { call } = setup()
    expect(() => call(HISTORY_CHANNELS.list, '/a.md')).toThrow()
    mkdirSync(join(directory, 'missing'))
    expect(call(HISTORY_CHANNELS.list, '/a.md')).toEqual([])
  })
})
