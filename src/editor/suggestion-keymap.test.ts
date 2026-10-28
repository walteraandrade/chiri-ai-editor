import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import { askBubble, bubbleField, bubbleVisible } from './ask-bubble'
import { focusEffect, interactionField } from './interaction-state'
import { openRefineEffect, refineInputField } from './refine-input'
import type { EditorHandle } from './suggestion-commands'
import {
  beginEffect,
  beginRefineEffect,
  failRefineEffect,
  resolveEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'
import { escapeAtCursor, openAskOrRefine } from './suggestion-keymap'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const createHandle = (anchor: number, head = anchor): EditorHandle => {
  let state = EditorState.create({
    doc: DOC,
    selection: { anchor, head },
    extensions: [
      suggestionsField,
      interactionField,
      askBubble,
      refineInputField,
    ],
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

const startRefine = (handle: EditorHandle): void =>
  handle.dispatch({
    effects: beginRefineEffect.of({
      id: 'a',
      instruction: { type: 'free-text', text: 'tighter' },
    }),
  })

const failRefine = (handle: EditorHandle): void =>
  handle.dispatch({
    effects: failRefineEffect.of({
      id: 'a',
      error: { type: 'network', message: 'offline' },
    }),
  })

const refineStatus = (handle: EditorHandle) => {
  const found = findSuggestion(suggestionsOf(handle.state), 'a')
  return found?.status === 'ready' ? found.refine.status : found?.status
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

describe('openAskOrRefine', () => {
  const askOpen = (handle: EditorHandle): boolean =>
    handle.state.field(bubbleField).askOpen

  it('opens the Refine input, not a new request, with the cursor inside a ready Suggestion', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)

    expect(openAskOrRefine(handle)).toBe(true)

    expect(handle.state.field(refineInputField)).toBe('a')
    expect(askOpen(handle)).toBe(false)
  })

  it('opens the Ask field when the cursor is outside every Suggestion', () => {
    const handle = createHandle(30)
    openReadySuggestion(handle)

    expect(openAskOrRefine(handle)).toBe(true)

    expect(handle.state.field(refineInputField)).toBeNull()
    expect(askOpen(handle)).toBe(true)
  })

  it('opens the Ask field for a selection inside a Suggestion', () => {
    const handle = createHandle(30)
    openReadySuggestion(handle)
    selectInside(handle)

    expect(openAskOrRefine(handle)).toBe(true)

    expect(handle.state.field(refineInputField)).toBeNull()
    expect(askOpen(handle)).toBe(true)
  })

  it('is not handled while the Suggestion is refining, and does not fall back to Ask', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    startRefine(handle)

    expect(openAskOrRefine(handle)).toBe(false)

    expect(handle.state.field(refineInputField)).toBeNull()
    expect(askOpen(handle)).toBe(false)
  })
})

describe('escapeAtCursor with the Refine input', () => {
  it('closes the Refine input first and keeps the Suggestion', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    expect(escapeAtCursor(handle)).toBe(true)

    expect(handle.state.field(refineInputField)).toBeNull()
    expect(findSuggestion(suggestionsOf(handle.state), 'a')?.status).toBe(
      'ready',
    )
  })

  it('rejects the Suggestion on the next press', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    escapeAtCursor(handle)
    escapeAtCursor(handle)

    expect(suggestionsOf(handle.state).items).toEqual([])
  })
})

describe('escapeAtCursor with a Refine', () => {
  it('cancels a running Refine first and keeps the Replacement', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    startRefine(handle)

    expect(escapeAtCursor(handle)).toBe(true)

    expect(refineStatus(handle)).toBe('idle')
    expect(suggestionsOf(handle.state).items).toHaveLength(1)
  })

  it('rejects the Suggestion on the press after the cancel', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    startRefine(handle)

    escapeAtCursor(handle)
    escapeAtCursor(handle)

    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('dismisses the error of a failed Refine first and keeps the Replacement', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    startRefine(handle)
    failRefine(handle)

    expect(escapeAtCursor(handle)).toBe(true)

    expect(refineStatus(handle)).toBe('idle')
    expect(suggestionsOf(handle.state).items).toHaveLength(1)
    expect(escapeAtCursor(handle)).toBe(true)
    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('closes the input, then dismisses the error, then rejects', () => {
    const handle = createHandle(5)
    openReadySuggestion(handle)
    startRefine(handle)
    failRefine(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    escapeAtCursor(handle)
    expect(handle.state.field(refineInputField)).toBeNull()
    expect(refineStatus(handle)).toBe('failed')

    escapeAtCursor(handle)
    expect(refineStatus(handle)).toBe('idle')

    escapeAtCursor(handle)
    expect(suggestionsOf(handle.state).items).toEqual([])
  })
})
