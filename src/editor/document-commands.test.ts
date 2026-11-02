import { history, redo, undo } from '@codemirror/commands'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { refreshDocument, replaceDocument } from './document-commands'
import type { EditorHandle } from './suggestion-commands'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'
const OPENED = '# Opened\n\nFrom a file.'

const createHandle = (doc = DOC, anchor = doc.length) => {
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

const begin = (handle: EditorHandle, id: string, from: number, to: number) =>
  handle.dispatch({
    effects: beginEffect.of({
      id,
      from,
      to,
      source: 'block',
      original: handle.state.doc.sliceString(from, to),
      instruction: quickActionInstruction('shorter'),
    }),
  })

describe('replaceDocument', () => {
  it('replaces the whole text and puts the cursor at the start', () => {
    const handle = createHandle()
    replaceDocument(handle, OPENED)
    expect(handle.state.doc.toString()).toBe(OPENED)
    expect(handle.state.selection.main.head).toBe(0)
  })

  it('drops every Suggestion, pending or ready, without a Discard notice', () => {
    const handle = createHandle()
    begin(handle, 'pending', 0, 21)
    begin(handle, 'ready', 23, 45)
    handle.dispatch({
      effects: resolveEffect.of({
        id: 'ready',
        result: {
          replacement: 'Second.',
          rationale: 'Shorter.',
          unchanged: false,
        },
      }),
    })
    replaceDocument(handle, OPENED)
    expect(suggestionsOf(handle.state).items).toEqual([])
    expect(suggestionsOf(handle.state).notice).toBeNull()
  })

  it('is one undo step, apart from the typing before it', () => {
    const handle = createHandle()
    handle.dispatch({
      changes: { from: DOC.length, insert: '!' },
      userEvent: 'input.type',
    })
    replaceDocument(handle, OPENED)
    undo(handle)
    expect(handle.state.doc.toString()).toBe(`${DOC}!`)
    redo(handle)
    expect(handle.state.doc.toString()).toBe(OPENED)
  })
})

describe('refreshDocument', () => {
  const EDITED = 'First paragraph here.\n\nSecond paragraph, now longer here.'

  it('takes the new text and keeps the cursor where the text did not change', () => {
    const handle = createHandle(DOC, 5)
    refreshDocument(handle, EDITED)
    expect(handle.state.doc.toString()).toBe(EDITED)
    expect(handle.state.selection.main.head).toBe(5)
  })

  it('moves the cursor along with a change before it', () => {
    const handle = createHandle(DOC, DOC.length)
    refreshDocument(handle, `Intro.\n\n${DOC}`)
    expect(handle.state.doc.toString()).toBe(`Intro.\n\n${DOC}`)
    expect(handle.state.selection.main.head).toBe(DOC.length + 8)
  })

  it('does not scroll the cursor into view', () => {
    const handle = createHandle(DOC, 5)
    const specs: TransactionSpec[] = []
    const dispatch = handle.dispatch
    refreshDocument(
      {
        get state() {
          return handle.state
        },
        dispatch: (spec) => {
          specs.push(spec)
          dispatch(spec)
        },
      },
      EDITED,
    )
    expect(specs.some((spec) => spec.scrollIntoView === true)).toBe(false)
  })

  it('drops every Suggestion, like Open', () => {
    const handle = createHandle()
    begin(handle, 'pending', 0, 21)
    refreshDocument(handle, EDITED)
    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('is one undo step, and undo brings the old text back', () => {
    const handle = createHandle()
    refreshDocument(handle, EDITED)
    undo(handle)
    expect(handle.state.doc.toString()).toBe(DOC)
  })
})
