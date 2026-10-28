import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave } from './autosave'

describe('createAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves only the latest text after the delay', () => {
    const save = vi.fn()
    const autosave = createAutosave({ save, delayMs: 300 })

    autosave.schedule('a')
    vi.advanceTimersByTime(200)
    autosave.schedule('ab')
    vi.advanceTimersByTime(299)
    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('ab')
  })

  it('flush saves the pending text immediately and only once', () => {
    const save = vi.fn()
    const autosave = createAutosave({ save, delayMs: 300 })

    autosave.schedule('pending')
    autosave.flush()
    vi.advanceTimersByTime(1000)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('pending')
  })

  it('flush does nothing when nothing is pending', () => {
    const save = vi.fn()
    const autosave = createAutosave({ save, delayMs: 300 })

    autosave.flush()

    expect(save).not.toHaveBeenCalled()
  })

  it('cancel drops the pending text', () => {
    const save = vi.fn()
    const autosave = createAutosave({ save, delayMs: 300 })

    autosave.schedule('dropped')
    autosave.cancel()
    vi.advanceTimersByTime(1000)

    expect(save).not.toHaveBeenCalled()
  })
})
