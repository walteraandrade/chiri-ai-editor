import { describe, expect, it } from 'vitest'
import { createExclusive } from './exclusive'

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('createExclusive', () => {
  it('runs a task and returns what it returns', async () => {
    const exclusive = createExclusive()
    expect(await exclusive(async () => 'done', 'busy')).toBe('done')
  })

  it('answers busy without running a task started while another waits', async () => {
    const exclusive = createExclusive()
    const gate = deferred<string>()
    let ran = false
    const first = exclusive(() => gate.promise, 'busy')
    const second = await exclusive(async () => {
      ran = true
      return 'second'
    }, 'busy')
    expect(second).toBe('busy')
    expect(ran).toBe(false)
    gate.resolve('first')
    expect(await first).toBe('first')
  })

  it('allows the next task once the first settled', async () => {
    const exclusive = createExclusive()
    await exclusive(async () => 'a', 'busy')
    expect(await exclusive(async () => 'b', 'busy')).toBe('b')
  })

  it('releases the lock when the task throws', async () => {
    const exclusive = createExclusive()
    await expect(
      exclusive(async () => {
        throw new Error('boom')
      }, 'busy'),
    ).rejects.toThrow('boom')
    expect(await exclusive(async () => 'after', 'busy')).toBe('after')
  })
})
