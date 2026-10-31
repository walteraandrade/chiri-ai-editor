import { describe, expect, it, vi } from 'vitest'
import { whenIdle } from './idle'

const IDLE_ID = 7
const TIMER_ID = 9

const scheduler = (withIdleCallback: boolean) => {
  const idle: (() => void)[] = []
  const timers: (() => void)[] = []
  return {
    idle,
    timers,
    target: {
      ...(withIdleCallback && {
        requestIdleCallback: vi.fn((run: () => void) => {
          idle.push(run)
          return IDLE_ID
        }),
        cancelIdleCallback: vi.fn(),
      }),
      setTimeout: vi.fn((run: () => void) => {
        timers.push(run)
        return TIMER_ID
      }),
      clearTimeout: vi.fn(),
    },
  }
}

describe('whenIdle', () => {
  it('waits for an idle period, with a timeout so a busy page still runs it', () => {
    const { idle, target } = scheduler(true)
    const run = vi.fn()

    whenIdle(run, target)
    expect(run).not.toHaveBeenCalled()
    idle[0]?.()

    expect(run).toHaveBeenCalledTimes(1)
    expect(target.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 2000 },
    )
    expect(target.setTimeout).not.toHaveBeenCalled()
  })

  it('cancels the idle callback', () => {
    const { target } = scheduler(true)

    whenIdle(() => {}, target)()

    expect(target.cancelIdleCallback).toHaveBeenCalledWith(IDLE_ID)
  })

  it('falls back to a timer where requestIdleCallback is missing', () => {
    const { timers, target } = scheduler(false)
    const run = vi.fn()

    const cancel = whenIdle(run, target)
    timers[0]?.()
    cancel()

    expect(run).toHaveBeenCalledTimes(1)
    expect(target.clearTimeout).toHaveBeenCalledWith(TIMER_ID)
  })
})
