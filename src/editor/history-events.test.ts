import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { HistoryEvent } from '../history/events'
import { quickActionInstruction } from '../suggestions/instruction'
import { reviewInstruction } from '../suggestions/review'
import type { Instruction, SuggestionOrigin } from '../suggestions/types'
import { replaceDocument } from './document-commands'
import { historyEventOf } from './history-events'
import {
  acceptAllReviewSuggestions,
  acceptSuggestionById,
  type EditorHandle,
} from './suggestion-commands'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const createHandle = () => {
  let state = EditorState.create({ doc: DOC, extensions: [suggestionsField] })
  const events: (HistoryEvent | null)[] = []
  const handle: EditorHandle = {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      const transaction = state.update(spec)
      events.push(historyEventOf(transaction))
      state = transaction.state
    },
  }
  return { handle, events, clear: () => events.splice(0) }
}

const ready = (
  handle: EditorHandle,
  {
    id,
    from,
    to,
    replacement,
    rationale,
    instruction,
    origin,
  }: {
    readonly id: string
    readonly from: number
    readonly to: number
    readonly replacement: string
    readonly rationale: string
    readonly instruction: Instruction
    readonly origin: SuggestionOrigin
  },
) => {
  handle.dispatch({
    effects: beginEffect.of({
      id,
      from,
      to,
      source: 'block',
      original: handle.state.doc.sliceString(from, to),
      instruction,
      origin,
    }),
  })
  handle.dispatch({
    effects: resolveEffect.of({
      id,
      result: { replacement, rationale, unchanged: false },
    }),
  })
}

describe('historyEventOf', () => {
  it('reports typing as an edit with the new text', () => {
    const { handle, events } = createHandle()
    handle.dispatch({
      changes: { from: 0, insert: '>' },
      userEvent: 'input.type',
    })
    expect(events).toEqual([{ type: 'edited', text: `>${DOC}` }])
  })

  it('ignores transactions that do not change the text', () => {
    const { handle, events } = createHandle()
    handle.dispatch({ selection: { anchor: 3 } })
    expect(events).toEqual([null])
  })

  it('reports an Accept with the Suggestion it applied', () => {
    const { handle, events, clear } = createHandle()
    ready(handle, {
      id: 's1',
      from: 0,
      to: 21,
      replacement: 'First.',
      rationale: 'Drops filler.',
      instruction: quickActionInstruction('shorter'),
      origin: 'ask',
    })
    clear()
    acceptSuggestionById(handle, 's1')
    expect(events).toEqual([
      {
        type: 'accepted',
        before: DOC,
        text: 'First.\n\nSecond paragraph here.',
        changes: [
          { origin: 'ask', instruction: 'Shorter', rationale: 'Drops filler.' },
        ],
      },
    ])
  })

  it('reports Accept all as one event listing every Suggestion', () => {
    const { handle, events, clear } = createHandle()
    ready(handle, {
      id: 'r1',
      from: 0,
      to: 21,
      replacement: 'First.',
      rationale: 'Shorter.',
      instruction: reviewInstruction('tone'),
      origin: 'review',
    })
    ready(handle, {
      id: 'r2',
      from: 23,
      to: DOC.length,
      replacement: 'Second.',
      rationale: 'Also shorter.',
      instruction: reviewInstruction('tone'),
      origin: 'review',
    })
    clear()
    acceptAllReviewSuggestions(handle)
    expect(events).toEqual([
      {
        type: 'accepted',
        before: DOC,
        text: 'First.\n\nSecond.',
        changes: [
          { origin: 'review', instruction: 'tone', rationale: 'Shorter.' },
          { origin: 'review', instruction: 'tone', rationale: 'Also shorter.' },
        ],
      },
    ])
  })

  it('reports Open and Restore as a replace with the text before it', () => {
    const { handle, events, clear } = createHandle()
    replaceDocument(handle, '# Opened')
    expect(events.at(-1)).toEqual({ type: 'replaced', before: DOC })
    clear()
    replaceDocument(handle, DOC, 'input.restore')
    expect(events.at(-1)).toEqual({ type: 'replaced', before: '# Opened' })
  })
})
