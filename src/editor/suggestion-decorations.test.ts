import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { bubbleField } from './ask-bubble'
import { expireMomentEffect, momentsOf, motionField } from './motion-field'
import {
  acceptSuggestionById,
  type EditorHandle,
  rejectSuggestionById,
} from './suggestion-commands'
import { buildDecorations } from './suggestion-decorations'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.'

const createHandle = (): EditorHandle => {
  let state = EditorState.create({
    doc: DOC,
    extensions: [suggestionsField, motionField, bubbleField],
  })
  return {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      state = state.update(spec).state
    },
  }
}

const open = (handle: EditorHandle): void => {
  handle.dispatch({
    effects: beginEffect.of({
      id: 'a',
      from: 0,
      to: 'First'.length,
      source: 'selection',
      original: 'First',
      instruction: quickActionInstruction('shorter'),
    }),
  })
  handle.dispatch({
    effects: resolveEffect.of({
      id: 'a',
      result: { replacement: 'Opening', rationale: 'Why.', unchanged: false },
    }),
  })
}

type Drawn = {
  readonly text: string
  readonly className: string
  readonly entering: boolean
}

const drawn = (state: EditorState): readonly Drawn[] => {
  const found: Drawn[] = []
  buildDecorations(state).between(0, state.doc.length, (from, to, value) => {
    const widget = value.spec.widget as
      | { readonly entering?: boolean }
      | undefined
    found.push({
      text: state.sliceDoc(from, to),
      className: String(value.spec.class ?? ''),
      entering: widget?.entering ?? false,
    })
  })
  return found
}

const classesOf = (state: EditorState): string =>
  drawn(state)
    .map((item) => item.className)
    .join(' ')

describe('buildDecorations motion', () => {
  it('marks a new Replacement as entering, then as settled in place', () => {
    const handle = createHandle()
    open(handle)
    expect(classesOf(handle.state)).toContain('cm-ai-deleted cm-ai-enter')
    expect(drawn(handle.state).some((item) => item.entering)).toBe(true)

    const [reveal] = momentsOf(handle.state)
    handle.dispatch({ effects: expireMomentEffect.of(reveal?.serial ?? -1) })
    expect(classesOf(handle.state)).not.toContain('cm-ai-enter')
    expect(drawn(handle.state).some((item) => item.entering)).toBe(false)
  })

  it('marks accepted text as landed', () => {
    const handle = createHandle()
    open(handle)
    acceptSuggestionById(handle, 'a')
    expect(drawn(handle.state)).toEqual([
      { text: 'Opening', className: 'cm-ai-landed', entering: false },
    ])
  })

  it('marks the original text as settled after a Reject', () => {
    const handle = createHandle()
    open(handle)
    rejectSuggestionById(handle, 'a')
    expect(drawn(handle.state)).toEqual([
      { text: 'First', className: 'cm-ai-settled', entering: false },
    ])
  })
})
