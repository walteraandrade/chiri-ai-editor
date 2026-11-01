import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHistoryRecorder } from './recorder'
import type { HistoryWrite } from './store'
import type { AcceptedChange, VersionCause } from './types'

const IDLE_MS = 30_000

const shorter: AcceptedChange = {
  origin: 'ask',
  instruction: 'Shorter',
  rationale: 'Drops filler.',
}

const createRecorder = () => {
  let time = 1000
  const writes: HistoryWrite[] = []
  const recorder = createHistoryRecorder({
    emit: (write) => {
      writes.push(write)
    },
    now: () => time,
    idleMs: IDLE_MS,
  })
  const tick = (ms: number) => {
    time += ms
    vi.advanceTimersByTime(ms)
  }
  return { recorder, writes, tick }
}

const recorded = (
  text: string,
  cause: VersionCause,
  at = 1000,
): HistoryWrite => ({ type: 'version-recorded', at, cause, text })

const summary = (writes: readonly HistoryWrite[]) =>
  writes.map((write) =>
    write.type === 'version-recorded'
      ? [write.cause.kind, write.text]
      : ['marked-saved', write.text, write.name],
  )

describe('createHistoryRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns edits into one Edited Version after the idle delay', () => {
    const { recorder, writes, tick } = createRecorder()
    recorder.edited('start a')
    tick(IDLE_MS - 1)
    recorder.edited('start ab')
    tick(IDLE_MS - 1)
    expect(writes).toEqual([])

    tick(1)
    expect(writes).toEqual([
      recorded('start ab', { kind: 'edited' }, 1000 + 2 * IDLE_MS - 1),
    ])
  })

  it('records pending edits on their own before an Accepted Version', () => {
    const { recorder, writes } = createRecorder()
    recorder.edited('start typed')
    recorder.accepted({
      before: 'start typed',
      text: 'typed',
      changes: [shorter],
    })
    expect(writes).toEqual([
      recorded('start typed', { kind: 'edited' }),
      recorded('typed', { kind: 'accepted', changes: [shorter] }),
    ])
  })

  it('records the text before an Accept even without a reported edit', () => {
    const { recorder, writes } = createRecorder()
    recorder.accepted({ before: 'unseen', text: 'after', changes: [shorter] })
    expect(summary(writes)).toEqual([
      ['edited', 'unseen'],
      ['accepted', 'after'],
    ])
  })

  it('cancels the idle timer once pending edits are recorded', () => {
    const { recorder, writes, tick } = createRecorder()
    recorder.edited('start typed')
    recorder.accepted({
      before: 'start typed',
      text: 'typed',
      changes: [shorter],
    })
    tick(IDLE_MS)
    expect(writes).toHaveLength(2)
  })

  it('records the text before a replace, then the Opened Version', () => {
    const { recorder, writes } = createRecorder()
    recorder.edited('start edited')
    recorder.replaced('start edited')
    recorder.opened({ text: '# File', name: 'file.md' })
    expect(writes).toEqual([
      recorded('start edited', { kind: 'edited' }),
      recorded('# File', { kind: 'opened', name: 'file.md' }),
    ])
  })

  it('records a Restored Version pointing at its source', () => {
    const { recorder, writes } = createRecorder()
    recorder.replaced('changed')
    recorder.restored({ text: 'start', from: 1 })
    expect(writes.at(-1)).toEqual(
      recorded('start', { kind: 'restored', from: 1 }),
    )
  })

  it('records the text before a replace even with no edit waiting', () => {
    const { recorder, writes } = createRecorder()
    recorder.replaced('changed elsewhere')
    expect(writes).toEqual([recorded('changed elsewhere', { kind: 'edited' })])
  })

  it('records pending edits when Save starts, then marks the saved text', () => {
    const { recorder, writes } = createRecorder()
    recorder.edited('start more')
    recorder.saving('start more')
    recorder.saved({ text: 'start more', name: 'notes.md' })
    expect(writes).toEqual([
      recorded('start more', { kind: 'edited' }),
      {
        type: 'version-marked-saved',
        text: 'start more',
        name: 'notes.md',
        at: 1000,
      },
    ])
  })

  it('records a Version when Save starts, even with no edit waiting', () => {
    const { recorder, writes } = createRecorder()
    recorder.saving('start s')
    expect(writes).toEqual([recorded('start s', { kind: 'edited' })])
  })

  it('drops the pending edits and their timer once Save starts', () => {
    const { recorder, writes, tick } = createRecorder()
    recorder.edited('start s')
    recorder.saving('start s')
    tick(IDLE_MS)
    expect(writes).toHaveLength(1)
  })

  it('keeps edits typed while a Save waits after the saved Version', () => {
    const { recorder, writes, tick } = createRecorder()
    recorder.edited('start a')
    recorder.saving('start a')
    recorder.edited('start a b')
    recorder.saved({ text: 'start a', name: 'notes.md' })
    expect(summary(writes)).toEqual([
      ['edited', 'start a'],
      ['marked-saved', 'start a', 'notes.md'],
    ])
    tick(IDLE_MS)
    expect(summary(writes)).toEqual([
      ['edited', 'start a'],
      ['marked-saved', 'start a', 'notes.md'],
      ['edited', 'start a b'],
    ])
  })

  it('marks the saved text after an Accept that came during the Save', () => {
    const { recorder, writes } = createRecorder()
    recorder.edited('start typed')
    recorder.saving('start typed')
    recorder.accepted({
      before: 'start typed',
      text: 'typed',
      changes: [shorter],
    })
    recorder.saved({ text: 'start typed', name: 'notes.md' })
    expect(summary(writes)).toEqual([
      ['edited', 'start typed'],
      ['edited', 'start typed'],
      ['accepted', 'typed'],
      ['marked-saved', 'start typed', 'notes.md'],
    ])
  })

  it('flush records pending edits right away, once', () => {
    const { recorder, writes, tick } = createRecorder()
    recorder.edited('start x')
    recorder.flush()
    recorder.flush()
    tick(IDLE_MS)
    expect(writes).toEqual([recorded('start x', { kind: 'edited' })])
  })

  it('writes nothing when there is nothing pending', () => {
    const { recorder, writes, tick } = createRecorder()
    recorder.flush()
    tick(IDLE_MS)
    expect(writes).toEqual([])
  })

  it('stamps writes with the injected clock', () => {
    const { recorder, writes, tick } = createRecorder()
    tick(500)
    recorder.opened({ text: 'file', name: 'file.md' })
    recorder.saved({ text: 'file', name: 'file.md' })
    expect(writes.map(({ at }) => at)).toEqual([1500, 1500])
  })
})
