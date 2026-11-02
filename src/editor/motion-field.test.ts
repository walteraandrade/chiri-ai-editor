import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import type { SuggestionDraft } from '../suggestions/types'
import { expireMomentEffect, momentsOf, motionField } from './motion-field'
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

describe('motionField', () => {
  it('records a reveal when a Replacement arrives', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening')
    expect(momentsOf(handle.state)).toEqual([
      { serial: 0, kind: 'reveal', id: 'a' },
    ])
  })

  it('records where accepted text landed', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening')
    acceptSuggestionById(handle, 'a')
    expect(momentsOf(handle.state)).toEqual([
      { serial: 1, kind: 'land', from: 0, to: 'Opening'.length },
    ])
  })

  it('records every landing of Accept all', () => {
    const handle = createHandle()
    open(handle, 'a', 'First', 'Opening', { origin: 'review' })
    open(handle, 'b', 'Second', '2nd', { origin: 'review' })
    acceptAllReviewSuggestions(handle)
    const lands = momentsOf(handle.state).filter(
      (moment) => moment.kind === 'land',
    )
    expect(
      lands.map((moment) =>
        moment.kind === 'land'
          ? handle.state.sliceDoc(moment.from, moment.to)
          : '',
      ),
    ).toEqual(['Opening', '2nd'])
  })

  it('records a settle where a rejected Suggestion was', () => {
    const handle = createHandle()
    open(handle, 'a', 'Second', 'Next')
    rejectSuggestionById(handle, 'a')
    const from = DOC.indexOf('Second')
    expect(momentsOf(handle.state)).toEqual([
      { serial: 1, kind: 'settle', from, to: from + 'Second'.length },
    ])
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
    handle.dispatch({ effects: expireMomentEffect.of(0) })
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
