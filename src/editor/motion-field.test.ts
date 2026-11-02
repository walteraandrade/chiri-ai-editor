import { EditorState, type TransactionSpec } from '@codemirror/state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import type { SuggestionDraft } from '../suggestions/types'
import {
  createExpiryScheduler,
  expireMomentEffect,
  momentsOf,
  motionField,
} from './motion-field'
import {
  acceptAllReviewSuggestions,
  acceptSuggestionById,
  type EditorHandle,
  rejectAllReviewSuggestions,
  rejectSuggestionById,
} from './suggestion-commands'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const createHandle = () => {
  let state = EditorState.create({
    doc: DOC,
    extensions: [suggestionsField, motionField],
  })
  const handle: EditorHandle & { readonly doc: () => string } = {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      state = state.update(spec).state
    },
    doc: () => state.doc.toString(),
  }
  return handle
}

const draft = (
  id: string,
  text: string,
  overrides: Partial<SuggestionDraft> = {},
): SuggestionDraft => {
  const from = DOC.indexOf(text)
  return {
    id,
    from,
    to: from + text.length,
    source: 'selection',
    original: text,
    instruction: quickActionInstruction('shorter'),
    ...overrides,
  }
}

const open = (
  handle: EditorHandle,
  id: string,
  text: string,
  replacement: string,
  overrides: Partial<SuggestionDraft> = {},
): void => {
  handle.dispatch({ effects: beginEffect.of(draft(id, text, overrides)) })
  handle.dispatch({
    effects: resolveEffect.of({
      id,
      result: { replacement, rationale: 'Because.', unchanged: false },
    }),
  })
}

const kinds = (handle: EditorHandle) =>
  momentsOf(handle.state).map((moment) => moment.kind)

const withoutSerials = (handle: EditorHandle) =>
  momentsOf(handle.state).map(({ serial: _serial, ...moment }) => moment)

const textsOf = (handle: EditorHandle, kind: 'land' | 'settle') =>
  momentsOf(handle.state).flatMap((moment) =>
    moment.kind === kind ? [handle.state.sliceDoc(moment.from, moment.to)] : [],
  )

describe('motionField', () => {
  it('records a reveal when a Replacement arrives', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening')
    expect(withoutSerials(handle)).toEqual([{ kind: 'reveal', id: 'a' }])
  })

  it('records where accepted text landed', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening')
    acceptSuggestionById(handle, 'a')
    expect(withoutSerials(handle)).toEqual([
      { kind: 'land', from: 0, to: 'Opening'.length },
    ])
  })

  it('records every landing of Accept all', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening', { origin: 'review' })
    open(handle, 'b', 'Second', '2nd', { origin: 'review' })
    acceptAllReviewSuggestions(handle)
    expect(textsOf(handle, 'land')).toEqual(['Opening', '2nd'])
  })

  it('records no landing when the accepted Replacement is empty', () => {
    const handle = createHandle()
    open(handle, 'a', 'Second paragraph here.', '')
    acceptSuggestionById(handle, 'a')
    expect(momentsOf(handle.state)).toEqual([])
  })

  it('records a settle where a rejected Suggestion was', () => {
    const handle = createHandle()
    open(handle, 'a', 'Second', 'Next')
    rejectSuggestionById(handle, 'a')
    expect(textsOf(handle, 'settle')).toEqual(['Second'])
  })

  it('settles every Review Suggestion on Reject all', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening', { origin: 'review' })
    open(handle, 'b', 'Second', '2nd', { origin: 'review' })
    rejectAllReviewSuggestions(handle)
    expect(kinds(handle)).toEqual(['settle', 'settle'])
  })

  it('drops a moment when it expires', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening')
    acceptSuggestionById(handle, 'a')
    const [land] = momentsOf(handle.state)
    handle.dispatch({ effects: expireMomentEffect.of(land?.serial ?? -1) })
    expect(momentsOf(handle.state)).toEqual([])
  })

  it('ends landings as soon as the writer edits again', () => {
    const handle = createHandle()
    open(handle, 'a', 'Second', 'Next')
    acceptSuggestionById(handle, 'a')
    handle.dispatch({ changes: { from: 0, insert: '>> ' } })
    expect(momentsOf(handle.state)).toEqual([])
  })

  it('keeps landings through selection moves', () => {
    const handle = createHandle()
    open(handle, 'a', 'Second', 'Next')
    acceptSuggestionById(handle, 'a')
    handle.dispatch({ selection: { anchor: 0 } })
    expect(kinds(handle)).toEqual(['land'])
  })

  it('reads as empty when the field is absent', () => {
    expect(momentsOf(EditorState.create({ doc: DOC }))).toEqual([])
  })
})

describe('createExpiryScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const reveal = { serial: 0, kind: 'reveal', id: 'a' } as const
  const settle = { serial: 1, kind: 'settle', from: 0, to: 5 } as const

  it('expires each moment once, after its own duration', () => {
    vi.useFakeTimers()
    const expired: number[] = []
    const scheduler = createExpiryScheduler((serial) => expired.push(serial))
    scheduler.schedule([reveal, settle])
    scheduler.schedule([reveal, settle])
    vi.advanceTimersByTime(499)
    expect(expired).toEqual([])
    vi.advanceTimersByTime(1)
    expect(expired).toEqual([1])
    vi.advanceTimersByTime(600)
    expect(expired).toEqual([1, 0])
  })

  it('expires nothing after it is destroyed', () => {
    vi.useFakeTimers()
    const expired: number[] = []
    const scheduler = createExpiryScheduler((serial) => expired.push(serial))
    scheduler.schedule([reveal])
    scheduler.destroy()
    vi.runAllTimers()
    expect(expired).toEqual([])
  })
})
