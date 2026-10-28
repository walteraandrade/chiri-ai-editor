import { history, undo } from '@codemirror/commands'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { SuggestionResult } from '../ai/edits'
import { quickActionInstruction } from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import type { SuggestionDraft } from '../suggestions/types'
import {
  acceptAtCursor,
  acceptSuggestionById,
  type EditorHandle,
  rejectAtCursor,
  rejectSuggestionById,
} from './suggestion-commands'
import {
  beginEffect,
  failEffect,
  resolveEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.\n\nThird one.'

const createHandle = (doc = DOC, anchor = 0) => {
  let state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [suggestionsField, history()],
  })
  const handle: EditorHandle = {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      state = state.update(spec).state
    },
  }
  return handle
}

const draft = (
  id: string,
  from: number,
  to: number,
  doc = DOC,
): SuggestionDraft => ({
  id,
  from,
  to,
  source: 'block',
  original: doc.slice(from, to),
  instruction: quickActionInstruction('shorter'),
})

const result = (replacement: string): SuggestionResult => ({
  replacement,
  rationale: 'Because.',
  unchanged: false,
})

const open = (handle: EditorHandle, id: string, from: number, to: number) => {
  handle.dispatch({ effects: beginEffect.of(draft(id, from, to)) })
  handle.dispatch({
    effects: resolveEffect.of({ id, result: result(`rewritten ${id}`) }),
  })
}

const FIRST = { from: 0, to: 21 }
const SECOND = { from: 23, to: 45 }

describe('suggestionsField', () => {
  it('maps open Suggestions through an edit outside of them', () => {
    const handle = createHandle()
    open(handle, 'b', SECOND.from, SECOND.to)

    handle.dispatch({ changes: { from: 0, insert: 'Intro.\n\n' } })

    expect(findSuggestion(suggestionsOf(handle.state), 'b')).toMatchObject({
      from: SECOND.from + 8,
      to: SECOND.to + 8,
    })
    expect(suggestionsOf(handle.state).notice).toBeNull()
  })

  it('discards a Suggestion edited inside, with a notice', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)
    open(handle, 'b', SECOND.from, SECOND.to)

    handle.dispatch({ changes: { from: 30, insert: 'x' } })

    const state = suggestionsOf(handle.state)
    expect(state.items.map((item) => item.id)).toEqual(['a'])
    expect(state.notice?.kind).toBe('text-changed')
  })

  it('discards a pending Suggestion when its Target is edited', () => {
    const handle = createHandle()
    handle.dispatch({
      effects: beginEffect.of(draft('a', FIRST.from, FIRST.to)),
    })

    handle.dispatch({ changes: { from: 5, to: 6, insert: 'X' } })

    expect(suggestionsOf(handle.state).items).toEqual([])
  })
})

describe('Accept', () => {
  it('replaces the range with the Replacement in one transaction and drops the Suggestion', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)
    open(handle, 'b', SECOND.from, SECOND.to)

    expect(acceptSuggestionById(handle, 'a')).toBe(true)

    expect(handle.state.doc.toString()).toBe(
      DOC.replace('First paragraph here.', 'rewritten a'),
    )
    const state = suggestionsOf(handle.state)
    expect(state.items.map((item) => item.id)).toEqual(['b'])
    expect(state.notice).toBeNull()
    expect(findSuggestion(state, 'b')).toMatchObject({
      from: SECOND.from - (21 - 'rewritten a'.length),
    })
  })

  it('is undone by a single undo that restores the original text', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)
    acceptSuggestionById(handle, 'a')

    undo({
      state: handle.state,
      dispatch: (transaction) => {
        handle.dispatch(transaction)
      },
    })

    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('only accepts ready Suggestions', () => {
    const handle = createHandle()
    handle.dispatch({
      effects: beginEffect.of(draft('a', FIRST.from, FIRST.to)),
    })
    expect(acceptSuggestionById(handle, 'a')).toBe(false)
    expect(acceptSuggestionById(handle, 'missing')).toBe(false)
    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('accepts at the cursor and ignores a cursor outside every Suggestion', () => {
    const inside = createHandle(DOC, 10)
    open(inside, 'a', FIRST.from, FIRST.to)
    expect(acceptAtCursor(inside)).toBe(true)

    const outside = createHandle(DOC, 55)
    open(outside, 'a', FIRST.from, FIRST.to)
    expect(acceptAtCursor(outside)).toBe(false)
    expect(outside.state.doc.toString()).toBe(DOC)
  })
})

describe('Accept key inside a Suggestion that is not ready', () => {
  it('is handled without touching the Document or the Suggestion while pending', () => {
    const handle = createHandle(DOC, 10)
    handle.dispatch({
      effects: beginEffect.of(draft('a', FIRST.from, FIRST.to)),
    })

    expect(acceptAtCursor(handle)).toBe(true)

    expect(handle.state.doc.toString()).toBe(DOC)
    expect(findSuggestion(suggestionsOf(handle.state), 'a')?.status).toBe(
      'pending',
    )
  })

  it('is handled without touching the Document or the Suggestion on error', () => {
    const handle = createHandle(DOC, 10)
    handle.dispatch({
      effects: beginEffect.of(draft('a', FIRST.from, FIRST.to)),
    })
    handle.dispatch({
      effects: failEffect.of({
        id: 'a',
        error: { type: 'network', message: 'offline' },
      }),
    })

    expect(acceptAtCursor(handle)).toBe(true)

    expect(handle.state.doc.toString()).toBe(DOC)
    expect(findSuggestion(suggestionsOf(handle.state), 'a')?.status).toBe(
      'error',
    )
  })
})

describe('Reject', () => {
  it('drops the Suggestion and leaves the Document unchanged', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)

    expect(rejectSuggestionById(handle, 'a')).toBe(true)

    expect(handle.state.doc.toString()).toBe(DOC)
    expect(suggestionsOf(handle.state).items).toEqual([])
    expect(suggestionsOf(handle.state).notice).toBeNull()
  })

  it('rejects at the cursor only when the cursor is inside a Suggestion', () => {
    const inside = createHandle(DOC, 21)
    open(inside, 'a', FIRST.from, FIRST.to)
    expect(rejectAtCursor(inside)).toBe(true)
    expect(suggestionsOf(inside.state).items).toEqual([])

    const outside = createHandle(DOC, 40)
    open(outside, 'a', FIRST.from, FIRST.to)
    expect(rejectAtCursor(outside)).toBe(false)
    expect(suggestionsOf(outside.state).items).toHaveLength(1)
  })
})
