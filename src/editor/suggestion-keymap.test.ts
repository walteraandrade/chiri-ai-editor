import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import { askBubble, bubbleVisible } from './ask-bubble'
import { focusEffect, interactionField } from './interaction-state'
import type { EditorHandle } from './suggestion-commands'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'
import { escapeAtCursor } from './suggestion-keymap'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const createHandle = (anchor: number, head = anchor): EditorHandle => {
  let state = EditorState.create({
    doc: DOC,
    selection: { anchor, head },
    extensions: [suggestionsField, interactionField, askBubble],
  })
  const handle: EditorHandle = {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      state = state.update(spec).state
    },
  }
  handle.dispatch({ effects: focusEffect.of(true) })
  return handle
}

const selectInside = (handle: EditorHandle): void =>
  handle.dispatch({ selection: { anchor: 2, head: 8 } })

const openReadySuggestion = (handle: EditorHandle): void => {
  handle.dispatch({
    effects: beginEffect.of({
      id: 'a',
      from: 0,
      to: 21,
      source: 'block',
      original: DOC.slice(0, 21),
      instruction: quickActionInstruction('shorter'),
    }),
  })
  handle.dispatch({
    effects: resolveEffect.of({
      id: 'a',
      result: {
        replacement: 'First.',
        rationale: 'Shorter.',
        unchanged: false,
      },
    }),
  })
}

describe('escapeAtCursor', () => {
  it('closes the bubble first and keeps the Suggestion under the selection', () => {
    const handle = createHandle(30)
    openReadySuggestion(handle)
    selectInside(handle)
    expect(bubbleVisible(handle.state)).toBe(true)

    expect(escapeAtCursor(handle)).toBe(true)

    expect(bubbleVisible(handle.state)).toBe(false)
    expect(findSuggestion(suggestionsOf(handle.state), 'a')?.status).toBe(
      'ready',
    )
  })

  it('rejects the Suggestion under the cursor on the next press', () => {
    const handle = createHandle(30)
    openReadySuggestion(handle)
    selectInside(handle)

    escapeAtCursor(handle)
    expect(escapeAtCursor(handle)).toBe(true)

    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('rejects straight away when no bubble is open', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    expect(bubbleVisible(handle.state)).toBe(false)

    expect(escapeAtCursor(handle)).toBe(true)

    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('does nothing outside a Suggestion with no bubble', () => {
    const handle = createHandle(30)
    openReadySuggestion(handle)

    expect(escapeAtCursor(handle)).toBe(false)
    expect(suggestionsOf(handle.state).items).toHaveLength(1)
  })
})
