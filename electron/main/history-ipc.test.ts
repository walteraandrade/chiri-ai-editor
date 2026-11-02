import { describe, expect, it, vi } from 'vitest'
import { HISTORY_CHANNELS } from '../history-api'
import type { HistoryHandlers } from './history-handlers'
import { registerHistoryIpc } from './history-ipc'

type Listener = (
  event: { readonly senderFrame: { readonly origin: string } | null },
  ...args: unknown[]
) => unknown

const trustedEvent = { senderFrame: { origin: 'http://localhost:5303' } }
const foreignEvent = { senderFrame: { origin: 'https://example.com' } }

const setup = () => {
  const listeners = new Map<string, Listener>()
  const handlers: HistoryHandlers = {
    list: vi.fn(() => []),
    text: vi.fn(() => 'text'),
    record: vi.fn(),
    markSaved: vi.fn(),
    loadUnsaved: vi.fn(() => null),
    saveUnsaved: vi.fn(),
    clearUnsaved: vi.fn(),
  }
  const getHandlers = vi.fn(() => handlers)
  registerHistoryIpc({
    ipcMain: {
      handle: (channel, listener) => listeners.set(channel, listener),
    },
    getHandlers,
    isTrusted: (event) =>
      event.senderFrame?.origin === trustedEvent.senderFrame.origin,
  })
  const call = (
    channel: string,
    event: Parameters<Listener>[0],
    ...args: unknown[]
  ) => {
    const listener = listeners.get(channel)
    if (!listener) throw new Error(`No handler for ${channel}`)
    return listener(event, ...args)
  }
  return { listeners, handlers, getHandlers, call }
}

describe('registerHistoryIpc', () => {
  it('registers one channel per action', () => {
    const { listeners } = setup()
    expect([...listeners.keys()].sort()).toEqual(
      Object.values(HISTORY_CHANNELS).sort(),
    )
  })

  it('does not open the History before the first call', () => {
    const { getHandlers } = setup()
    expect(getHandlers).not.toHaveBeenCalled()
  })

  it('passes the arguments of a trusted call to its handler', () => {
    const { call, handlers } = setup()
    call(HISTORY_CHANNELS.text, trustedEvent, '/a.md', 3)
    expect(handlers.text).toHaveBeenCalledWith('/a.md', 3)
    call(HISTORY_CHANNELS.record, trustedEvent, '/a.md', { text: 'x' })
    expect(handlers.record).toHaveBeenCalledWith('/a.md', { text: 'x' })
    call(HISTORY_CHANNELS.unsavedSave, trustedEvent, '/a.md', {
      text: 'draft',
      base: 'disk',
    })
    expect(handlers.saveUnsaved).toHaveBeenCalledWith('/a.md', {
      text: 'draft',
      base: 'disk',
    })
  })

  it('returns what the handler returns', () => {
    const { call } = setup()
    expect(call(HISTORY_CHANNELS.text, trustedEvent, '/a.md', 1)).toBe('text')
  })

  it('rejects a call from a frame that is not the app', () => {
    const { listeners, call, handlers, getHandlers } = setup()
    for (const channel of listeners.keys())
      expect(() => call(channel, foreignEvent, '/a.md', 1)).toThrow(
        /untrusted/i,
      )
    expect(() => call(HISTORY_CHANNELS.list, { senderFrame: null })).toThrow(
      /untrusted/i,
    )
    expect(getHandlers).not.toHaveBeenCalled()
    expect(handlers.list).not.toHaveBeenCalled()
  })
})
