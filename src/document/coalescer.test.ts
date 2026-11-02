import { describe, expect, it, vi } from 'vitest'
import { createCoalescer } from './coalescer'

const deferred = () => {
  let finish: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    finish = resolve
  })
  return { promise, finish }
}

describe('createCoalescer', () => {
  it('runs the task when asked and resolves when it is done', async () => {
    let runs = 0
    const coalescer = createCoalescer(async () => {
      runs += 1
    })
    await coalescer.request()
    expect(runs).toBe(1)
  })

  it('runs once more, not once per request, after requests made during a run', async () => {
    const gates = [deferred(), deferred(), deferred()]
    let runs = 0
    const coalescer = createCoalescer(async () => {
      const gate = gates[runs]
      runs += 1
      await gate?.promise
    })
    const first = coalescer.request()
    void coalescer.request()
    void coalescer.request()
    void coalescer.request()
    expect(runs).toBe(1)
    gates[0]?.finish()
    await vi.waitFor(() => expect(runs).toBe(2))
    gates[1]?.finish()
    await first
    expect(runs).toBe(2)
  })

  it('keeps going after a task fails and reports no unhandled rejection', async () => {
    let runs = 0
    const coalescer = createCoalescer(async () => {
      runs += 1
      if (runs === 1) throw new Error('boom')
    })
    await coalescer.request()
    await coalescer.request()
    expect(runs).toBe(2)
  })

  it('lets every caller wait for the run that covers their request', async () => {
    const gate = deferred()
    const order: string[] = []
    let runs = 0
    const coalescer = createCoalescer(async () => {
      runs += 1
      const mine = runs
      if (mine === 1) await gate.promise
      order.push(`run ${mine}`)
    })
    const first = coalescer.request().then(() => order.push('first done'))
    const second = coalescer.request().then(() => order.push('second done'))
    gate.finish()
    await Promise.all([first, second])
    expect(order).toEqual(['run 1', 'run 2', 'first done', 'second done'])
  })
})
