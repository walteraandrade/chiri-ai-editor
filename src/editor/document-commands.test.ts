import { history, redo, undo } from '@codemirror/commands'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { replaceDocument } from './document-commands'
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
