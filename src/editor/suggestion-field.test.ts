import { history, undo } from '@codemirror/commands'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { SuggestionResult } from '../ai/edits'
import { quickActionInstruction } from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import type { SuggestionDraft } from '../suggestions/types'
import {
  acceptAllReviewSuggestions,
  acceptAtCursor,
  acceptSuggestionById,
  type EditorHandle,
  rejectAllReviewSuggestions,
  rejectAtCursor,
  rejectSuggestionById,
} from './suggestion-commands'
import {
  beginEffect,
  beginRefineEffect,
  failEffect,
  resolveEffect,
  resolveRefineEffect,
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

const open = (
  handle: EditorHandle,
  id: string,
  from: number,
  to: number,
  origin: SuggestionDraft['origin'] = 'ask',
) => {
  handle.dispatch({
    effects: beginEffect.of({ ...draft(id, from, to), origin }),
  })
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

describe('Accept after Refine', () => {
  const refined = (handle: EditorHandle, id: string, replacement: string) => {
    handle.dispatch({
      effects: beginRefineEffect.of({
        id,
        instruction: { type: 'free-text', text: 'tighter' },
      }),
    })
    handle.dispatch({
      effects: resolveRefineEffect.of({ id, result: result(replacement) }),
    })
  }

  it('applies the latest Replacement in one transaction that one undo reverts', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)
    refined(handle, 'a', 'first refine')
    refined(handle, 'a', 'second refine')

    expect(acceptSuggestionById(handle, 'a')).toBe(true)
    expect(handle.state.doc.toString()).toBe(
      DOC.replace('First paragraph here.', 'second refine'),
    )
    expect(suggestionsOf(handle.state).items).toEqual([])

    undo({
      state: handle.state,
      dispatch: (transaction) => {
        handle.dispatch(transaction)
      },
    })
    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('applies the current Replacement when accepted during a Refine', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)
    handle.dispatch({
      effects: beginRefineEffect.of({
        id: 'a',
        instruction: { type: 'free-text', text: 'tighter' },
      }),
    })

    expect(acceptSuggestionById(handle, 'a')).toBe(true)

    expect(handle.state.doc.toString()).toBe(
      DOC.replace('First paragraph here.', 'rewritten a'),
    )
    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('discards a Suggestion that is edited inside while it refines', () => {
    const handle = createHandle()
    open(handle, 'a', FIRST.from, FIRST.to)
    handle.dispatch({
      effects: beginRefineEffect.of({
        id: 'a',
        instruction: { type: 'free-text', text: 'tighter' },
      }),
    })

    handle.dispatch({ changes: { from: 5, insert: 'x' } })

    expect(suggestionsOf(handle.state).items).toEqual([])
    expect(suggestionsOf(handle.state).notice?.kind).toBe('text-changed')
  })
})

describe('Accept all and Reject all', () => {
  const THIRD = { from: 47, to: 57 }

  const withReview = () => {
    const handle = createHandle()
    open(handle, 'r1', FIRST.from, FIRST.to, 'review')
    open(handle, 'ask', SECOND.from, SECOND.to)
    open(handle, 'r2', THIRD.from, THIRD.to, 'review')
    return handle
  }

  const undoAll = (handle: EditorHandle) =>
    undo({
      state: handle.state,
      dispatch: (transaction) => {
        handle.dispatch(transaction)
      },
    })

  it('applies every ready review Suggestion and nothing else', () => {
    const handle = withReview()

    expect(acceptAllReviewSuggestions(handle)).toBe(true)

    expect(handle.state.doc.toString()).toBe(
      'rewritten r1\n\nSecond paragraph here.\n\nrewritten r2',
    )
    const state = suggestionsOf(handle.state)
    expect(state.items.map((item) => item.id)).toEqual(['ask'])
    expect(state.notice).toBeNull()
    expect(findSuggestion(state, 'ask')).toMatchObject({
      from: 'rewritten r1\n\n'.length,
      to: 'rewritten r1\n\nSecond paragraph here.'.length,
    })
  })

  it('is one transaction: a single undo restores every Replacement', () => {
    const handle = withReview()
    acceptAllReviewSuggestions(handle)

    undoAll(handle)

    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('does one transaction even for many Suggestions', () => {
    let count = 0
    const base = withReview()
    const handle: EditorHandle = {
      get state() {
        return base.state
      },
      dispatch: (spec) => {
        count += 1
        base.dispatch(spec)
      },
    }

    acceptAllReviewSuggestions(handle)

    expect(count).toBe(1)
  })

  it('keeps the other Suggestions mapped through the combined change', () => {
    const handle = createHandle()
    open(handle, 'r1', FIRST.from, FIRST.to, 'review')
    open(handle, 'ask', SECOND.from, SECOND.to)

    acceptAllReviewSuggestions(handle)

    const kept = findSuggestion(suggestionsOf(handle.state), 'ask')
    expect(kept).toMatchObject({ status: 'ready', origin: 'ask' })
    expect(handle.state.doc.sliceString(kept?.from ?? 0, kept?.to ?? 0)).toBe(
      'Second paragraph here.',
    )
  })

  it('does nothing without a ready review Suggestion', () => {
    const handle = createHandle()
    open(handle, 'ask', FIRST.from, FIRST.to)
    handle.dispatch({
      effects: beginEffect.of({
        ...draft('pending', SECOND.from, SECOND.to),
        origin: 'review',
      }),
    })

    expect(acceptAllReviewSuggestions(handle)).toBe(false)
    expect(handle.state.doc.toString()).toBe(DOC)
    expect(suggestionsOf(handle.state).items).toHaveLength(2)
  })

  it('rejects only review Suggestions and leaves the Document alone', () => {
    const handle = withReview()

    expect(rejectAllReviewSuggestions(handle)).toBe(true)

    expect(handle.state.doc.toString()).toBe(DOC)
    expect(suggestionsOf(handle.state).items.map((item) => item.id)).toEqual([
      'ask',
    ])
    expect(suggestionsOf(handle.state).notice).toBeNull()
  })

  it('reports nothing to reject without review Suggestions', () => {
    const handle = createHandle()
    open(handle, 'ask', FIRST.from, FIRST.to)
    expect(rejectAllReviewSuggestions(handle)).toBe(false)
  })
})
