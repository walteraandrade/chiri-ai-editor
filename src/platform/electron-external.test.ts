import { describe, expect, it, vi } from 'vitest'
import { type ExternalChanges, FILE_NOT_FOUND_REASON } from '../../electron/api'
import {
  createElectronExternal,
  type ExternalApi,
  pathTouched,
} from './electron-external'

const api = (overrides: Partial<ExternalApi> = {}) => {
  const listeners = new Set<(changes: ExternalChanges) => void>()
  const bridge: ExternalApi = {
    watchFile: vi.fn(async () => undefined),
    readFile: vi.fn(async () => ({
      kind: 'opened' as const,
      path: '/skills/a/SKILL.md',
      name: 'SKILL.md',
      text: '# A\n',
    })),
    onExternalChanges: vi.fn((listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    ...overrides,
  }
  return {
    bridge,
    push: (changes: ExternalChanges) => {
      for (const listener of listeners) listener(changes)
    },
    listening: () => listeners.size,
  }
}

describe('pathTouched', () => {
  it('matches the file itself', () => {
    expect(pathTouched('/skills/a/SKILL.md', ['/skills/a/SKILL.md'])).toBe(true)
  })

  it('matches a folder that holds the file, which is how a burst is reported', () => {
    expect(pathTouched('/skills/a/SKILL.md', ['/skills/a'])).toBe(true)
    expect(pathTouched('/skills/a/SKILL.md', ['/skills'])).toBe(true)
  })

  it('does not match a sibling, a longer name or an unrelated path', () => {
    expect(pathTouched('/skills/a/SKILL.md', ['/skills/a/OTHER.md'])).toBe(
      false,
    )
    expect(pathTouched('/skills/ab/SKILL.md', ['/skills/a'])).toBe(false)
    expect(pathTouched('/skills/a/SKILL.md', ['/other'])).toBe(false)
    expect(pathTouched('/skills/a/SKILL.md', [])).toBe(false)
  })
})

describe('createElectronExternal', () => {
  it('asks the main process to watch the open file, and to stop', () => {
    const { bridge } = api()
    const external = createElectronExternal(bridge)
    external.watch('/skills/a/SKILL.md')
    external.watch(null)
    expect(bridge.watchFile).toHaveBeenNthCalledWith(1, '/skills/a/SKILL.md')
    expect(bridge.watchFile).toHaveBeenNthCalledWith(2, null)
  })

  it('does not throw when the main process cannot be reached', async () => {
    const { bridge } = api({
      watchFile: async () => {
        throw new Error('IPC closed')
      },
    })
    expect(() =>
      createElectronExternal(bridge).watch('/skills/a/SKILL.md'),
    ).not.toThrow()
    await Promise.resolve()
  })

  it('tells listeners which files a push touched', () => {
    const { bridge, push } = api()
    const touched: boolean[] = []
    createElectronExternal(bridge).subscribe((change) => {
      touched.push(change.touches('/skills/a/SKILL.md'))
    })
    push({ paths: ['/skills/a/SKILL.md'], library: false })
    push({ paths: ['/skills/b/SKILL.md'], library: true })
    expect(touched).toEqual([true, false])
  })

  it('stops listening when unsubscribed', () => {
    const { bridge, listening } = api()
    const stop = createElectronExternal(bridge).subscribe(() => undefined)
    expect(listening()).toBe(1)
    stop()
    expect(listening()).toBe(0)
  })

  it('reads the disk text without the lock the Open and Save calls share', async () => {
    const { bridge } = api()
    expect(
      await createElectronExternal(bridge).readDisk('/skills/a/SKILL.md'),
    ).toEqual({ kind: 'text', name: 'SKILL.md', text: '# A\n' })
    expect(bridge.readFile).toHaveBeenCalledWith('/skills/a/SKILL.md')
  })

  it('reads a missing file as gone', async () => {
    const { bridge } = api({
      readFile: async () => ({
        kind: 'failed',
        reason: FILE_NOT_FOUND_REASON,
      }),
    })
    expect(
      await createElectronExternal(bridge).readDisk('/skills/a/SKILL.md'),
    ).toEqual({ kind: 'gone' })
  })

  it('reads any other failure as unreadable', async () => {
    const failed = api({
      readFile: async () => ({
        kind: 'failed',
        reason: 'Not valid UTF-8 text',
      }),
    })
    const cancelled = api({ readFile: async () => ({ kind: 'cancelled' }) })
    const thrown = api({
      readFile: async () => {
        throw new Error('IPC closed')
      },
    })
    for (const { bridge } of [failed, cancelled, thrown])
      expect(
        await createElectronExternal(bridge).readDisk('/skills/a/SKILL.md'),
      ).toEqual({ kind: 'unreadable' })
  })
})
