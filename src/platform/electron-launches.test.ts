import { describe, expect, it, vi } from 'vitest'
import { createElectronLaunches, type LaunchApi } from './electron-launches'

const createFakeApi = (waiting: (string | null)[] = []) => {
  const pings = new Set<() => void>()
  const api = {
    takeLaunchFile: vi.fn(async () => waiting.shift() ?? null),
    onLaunchFile: vi.fn((listener: () => void) => {
      pings.add(listener)
      return () => {
        pings.delete(listener)
      }
    }),
  } satisfies LaunchApi
  const ping = () => {
    for (const listener of pings) listener()
  }
  return { api, ping, pings }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createElectronLaunches', () => {
  it('takes the file the app was started with', async () => {
    const { api } = createFakeApi(['/notes/a.md'])
    expect(await createElectronLaunches(api).take()).toBe('/notes/a.md')
  })

  it('takes nothing when the main process cannot answer', async () => {
    const { api } = createFakeApi()
    api.takeLaunchFile.mockRejectedValueOnce(new Error('gone'))
    expect(await createElectronLaunches(api).take()).toBeNull()
  })

  it('hands each later launch to the listener', async () => {
    const waiting: (string | null)[] = []
    const { api, ping } = createFakeApi(waiting)
    const listener = vi.fn()
    createElectronLaunches(api).subscribe(listener)
    waiting.push('/notes/b.md')
    ping()
    await settle()
    expect(listener).toHaveBeenCalledExactlyOnceWith('/notes/b.md')
  })

  it('takes a launch that arrived before the listener', async () => {
    const { api } = createFakeApi(['/notes/early.md'])
    const listener = vi.fn()
    createElectronLaunches(api).subscribe(listener)
    await settle()
    expect(listener).toHaveBeenCalledExactlyOnceWith('/notes/early.md')
  })

  it('stays quiet when a ping finds nothing waiting', async () => {
    const { api, ping } = createFakeApi()
    const listener = vi.fn()
    createElectronLaunches(api).subscribe(listener)
    ping()
    await settle()
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops listening on unsubscribe', () => {
    const { api, pings } = createFakeApi()
    const stop = createElectronLaunches(api).subscribe(() => undefined)
    stop()
    expect(pings.size).toBe(0)
  })
})
