import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startHistory } from './history'
import { createHistoryRecorder } from './recorder'
import type { AcceptedChange, History } from './types'

const IDLE_MS = 30_000

const shorter: AcceptedChange = {
  origin: 'ask',
  instruction: 'Shorter',
  rationale: 'Drops filler.',
}

const createRecorder = (initial: History = startHistory('start', 0)) => {
  let time = 1000
  const persist = vi.fn()
  const recorder = createHistoryRecorder({
    initial,
    persist,
    now: () => time,
    idleMs: IDLE_MS,
  })
  const tick = (ms: number) => {
    time += ms
    vi.advanceTimersByTime(ms)
  }
  return { recorder, persist, tick }
}

const causes = (history: History) =>
  history.map((version) => version.cause.kind)

describe('createHistoryRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns edits into one Edited Version after the idle delay', () => {
    const { recorder, persist, tick } = createRecorder()
    recorder.edited('start a')
    tick(IDLE_MS - 1)
    recorder.edited('start ab')
    tick(IDLE_MS - 1)
    expect(recorder.snapshot()).toHaveLength(1)

    tick(1)
    expect(recorder.snapshot().at(-1)).toMatchObject({
      cause: { kind: 'edited' },
      text: 'start ab',
    })
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('records pending edits on their own before an Accepted Version', () => {
    const { recorder } = createRecorder()
    recorder.edited('start typed')
    recorder.accepted({
      before: 'start typed',
      text: 'typed',
      changes: [shorter],
    })
    expect(causes(recorder.snapshot())).toEqual([
      'started',
      'edited',
      'accepted',
    ])
    expect(recorder.snapshot().at(-1)).toMatchObject({
      cause: { kind: 'accepted', changes: [shorter] },
      text: 'typed',
    })
  })

  it('records the text before an Accept even without a reported edit', () => {
    const { recorder } = createRecorder()
    recorder.accepted({ before: 'unseen', text: 'after', changes: [shorter] })
    expect(causes(recorder.snapshot())).toEqual([
      'started',
      'edited',
      'accepted',
    ])
    expect(recorder.snapshot()[1]?.text).toBe('unseen')
  })

  it('cancels the idle timer once pending edits are recorded', () => {
    const { recorder, tick } = createRecorder()
    recorder.edited('start typed')
    recorder.accepted({
      before: 'start typed',
      text: 'typed',
      changes: [shorter],
    })
    tick(IDLE_MS)
    expect(recorder.snapshot()).toHaveLength(3)
  })

  it('records the text before a replace, then the Opened Version', () => {
    const { recorder } = createRecorder()
    recorder.edited('start edited')
    recorder.replaced('start edited')
    recorder.opened({ text: '# File', name: 'file.md' })
    expect(recorder.snapshot().slice(1)).toMatchObject([
      { cause: { kind: 'edited' }, text: 'start edited' },
      { cause: { kind: 'opened', name: 'file.md' }, text: '# File' },
    ])
  })

  it('records a Restored Version pointing at its source', () => {
    const { recorder } = createRecorder()
    recorder.edited('changed')
    recorder.replaced('changed')
    recorder.restored({ text: 'start', from: 1 })
    expect(recorder.snapshot().at(-1)).toMatchObject({
      cause: { kind: 'restored', from: 1 },
      text: 'start',
    })
  })

  it('marks the saved text, recording pending edits first', () => {
    const { recorder } = createRecorder()
    recorder.edited('start more')
    recorder.saved({ text: 'start more', name: 'notes.md' })
    expect(recorder.snapshot().at(-1)).toMatchObject({
      cause: { kind: 'edited' },
      text: 'start more',
      saved: 'notes.md',
    })
  })

  it('keeps edits typed while a Save waits after the saved Version', () => {
    const { recorder, tick } = createRecorder()
    recorder.edited('start a')
    recorder.edited('start a b')
    recorder.saved({ text: 'start a', name: 'notes.md' })
    expect(recorder.snapshot().slice(1)).toMatchObject([
      { cause: { kind: 'edited' }, text: 'start a', saved: 'notes.md' },
    ])
    tick(IDLE_MS)
    expect(recorder.snapshot().slice(1)).toMatchObject([
      { text: 'start a', saved: 'notes.md' },
      { cause: { kind: 'edited' }, text: 'start a b' },
    ])
  })

  it('marks the saved text in place when an Accept came during the Save', () => {
    const { recorder } = createRecorder()
    recorder.edited('start typed')
    recorder.accepted({
      before: 'start typed',
      text: 'typed',
      changes: [shorter],
    })
    recorder.saved({ text: 'start typed', name: 'notes.md' })
    expect(
      recorder.snapshot().map((version) => [version.text, version.saved]),
    ).toEqual([
      ['start', undefined],
      ['start typed', 'notes.md'],
      ['typed', undefined],
    ])
  })

  it('saves edits that went back to an older text as a new Version', () => {
    const { recorder } = createRecorder()
    recorder.edited('start x')
    recorder.flush()
    recorder.edited('start')
    recorder.saved({ text: 'start', name: 'notes.md' })
    expect(
      recorder.snapshot().map((version) => [version.text, version.saved]),
    ).toEqual([
      ['start', undefined],
      ['start x', undefined],
      ['start', 'notes.md'],
    ])
  })

  it('records the text before a replace even with no edit waiting', () => {
    const { recorder } = createRecorder()
    recorder.replaced('changed elsewhere')
    expect(recorder.snapshot().at(-1)).toMatchObject({
      cause: { kind: 'edited' },
      text: 'changed elsewhere',
    })
  })

  it('flush records pending edits right away, once', () => {
    const { recorder, persist, tick } = createRecorder()
    recorder.edited('start x')
    recorder.flush()
    recorder.flush()
    tick(IDLE_MS)
    expect(recorder.snapshot()).toHaveLength(2)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('does not persist or notify when nothing changed', () => {
    const { recorder, persist } = createRecorder()
    const listener = vi.fn()
    recorder.subscribe(listener)
    recorder.edited('start')
    recorder.flush()
    expect(persist).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies subscribers until they unsubscribe', () => {
    const { recorder } = createRecorder()
    const listener = vi.fn()
    const unsubscribe = recorder.subscribe(listener)
    recorder.opened({ text: 'one', name: 'one.md' })
    unsubscribe()
    recorder.opened({ text: 'two', name: 'two.md' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stamps Versions with the injected clock', () => {
    const { recorder, tick } = createRecorder()
    tick(500)
    recorder.opened({ text: 'file', name: 'file.md' })
    expect(recorder.snapshot().at(-1)?.at).toBe(1500)
  })
})
