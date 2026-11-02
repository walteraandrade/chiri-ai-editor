import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBatcher } from './batcher'

describe('createBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hands over a burst as one batch once it goes quiet', () => {
    const flush = vi.fn()
    const batcher = createBatcher<number>({
      delayMs: 100,
      maxWaitMs: 1000,
      flush,
    })
    batcher.add(1)
    vi.advanceTimersByTime(60)
    batcher.add(2)
    vi.advanceTimersByTime(60)
    batcher.add(3)
    expect(flush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(flush).toHaveBeenCalledOnce()
    expect(flush).toHaveBeenCalledWith([1, 2, 3])
  })

  it('does not wait for ever while events keep coming', () => {
    const flush = vi.fn()
    const batcher = createBatcher<number>({
      delayMs: 100,
      maxWaitMs: 350,
      flush,
    })
    Array.from({ length: 10 }).forEach((_, index) => {
      batcher.add(index)
      vi.advanceTimersByTime(60)
    })
    expect(flush).toHaveBeenCalled()
    expect(flush.mock.calls[0]?.[0].length).toBeGreaterThan(0)
  })

  it('starts a new batch after a flush', () => {
    const flush = vi.fn()
    const batcher = createBatcher<string>({
      delayMs: 50,
      maxWaitMs: 500,
      flush,
    })
    batcher.add('a')
    vi.advanceTimersByTime(50)
    batcher.add('b')
    vi.advanceTimersByTime(50)
    expect(flush.mock.calls).toEqual([[['a']], [['b']]])
  })

  it('drops what is waiting when cancelled', () => {
    const flush = vi.fn()
    const batcher = createBatcher<string>({
      delayMs: 50,
      maxWaitMs: 500,
      flush,
    })
    batcher.add('a')
    batcher.cancel()
    vi.advanceTimersByTime(1000)
    expect(flush).not.toHaveBeenCalled()
  })
})
