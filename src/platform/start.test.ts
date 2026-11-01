import { describe, expect, it, vi } from 'vitest'
import type { PlatformKit } from './kit'
import { startWith } from './start'

const kit = { marker: 'kit' } as unknown as PlatformKit

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('startWith', () => {
  it('renders once with the kit the factory resolves', async () => {
    const render = vi.fn()
    await startWith(async () => kit, render)
    expect(render).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledWith(kit)
  })

  it('renders nothing until the factory resolves', async () => {
    const render = vi.fn()
    const pending = deferred<PlatformKit>()
    const started = startWith(() => pending.promise, render)
    await Promise.resolve()
    expect(render).not.toHaveBeenCalled()
    pending.resolve(kit)
    await started
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('calls the factory once', async () => {
    const factory = vi.fn(async () => kit)
    await startWith(factory, vi.fn())
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('renders nothing and rejects when the factory rejects', async () => {
    const render = vi.fn()
    const failure = new Error('main process unavailable')
    await expect(startWith(() => Promise.reject(failure), render)).rejects.toBe(
      failure,
    )
    expect(render).not.toHaveBeenCalled()
  })
})
