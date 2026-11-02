import { EditorState, type StateEffect } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  freeTextInstruction,
  quickActionInstruction,
} from '../suggestions/instruction'
import type { SuggestionDraft } from '../suggestions/types'
import { aiCaretOf } from './ai-caret'
import { reviewRunField, startReviewEffect } from './review-field'
import {
  beginEffect,
  beginRefineEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const stateWith = (...steps: StateEffect<unknown>[][]): EditorState =>
  steps.reduce(
    (state, effects) => state.update({ effects }).state,
    EditorState.create({
      doc: DOC,
      extensions: [suggestionsField, reviewRunField],
    }),
  )

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

const resolved = (id: string) =>
  resolveEffect.of({
    id,
    result: { replacement: 'New', rationale: 'Because.', unchanged: false },
  })

const endOf = (text: string): number => DOC.indexOf(text) + text.length

describe('aiCaretOf', () => {
  it('is absent while the AI is idle', () => {
    expect(aiCaretOf(stateWith())).toBeNull()
    expect(
      aiCaretOf(
        stateWith([beginEffect.of(draft('a', 'First'))], [resolved('a')]),
      ),
    ).toBeNull()
  })

  it('sits at the end of a pending Target, labeled with its Instruction', () => {
    expect(
      aiCaretOf(stateWith([beginEffect.of(draft('a', 'Second paragraph'))])),
    ).toEqual({ pos: endOf('Second paragraph'), label: 'Shorter' })
  })

  it('follows the latest pending request', () => {
    expect(
      aiCaretOf(
        stateWith(
          [beginEffect.of(draft('a', 'Second'))],
          [
            beginEffect.of(
              draft('b', 'First', {
                instruction: freeTextInstruction('Warmer, please'),
              }),
            ),
          ],
        ),
      ),
    ).toEqual({ pos: endOf('First'), label: 'Warmer, please' })
  })

  it('shows a Refine at work before anything else', () => {
    expect(
      aiCaretOf(
        stateWith(
          [beginEffect.of(draft('a', 'First'))],
          [resolved('a')],
          [beginEffect.of(draft('b', 'Second'))],
          [
            beginRefineEffect.of({
              id: 'a',
              instruction: freeTextInstruction('Even shorter'),
            }),
          ],
        ),
      ),
    ).toEqual({ pos: endOf('First'), label: 'Even shorter' })
  })

  it('starts a Review pass at the top of the Document', () => {
    expect(aiCaretOf(stateWith([startReviewEffect.of({ focus: '' })]))).toEqual(
      { pos: 0, label: 'Reviewing' },
    )
  })

  it('hops to the newest Review Suggestion', () => {
    expect(
      aiCaretOf(
        stateWith(
          [startReviewEffect.of({ focus: 'tone' })],
          [
            beginEffect.of(draft('r1', 'First', { origin: 'review' })),
            resolved('r1'),
          ],
          [
            beginEffect.of(
              draft('r2', 'Second paragraph', { origin: 'review' }),
            ),
            resolved('r2'),
          ],
        ),
      ),
    ).toEqual({ pos: endOf('Second paragraph'), label: 'Reviewing' })
  })

  it('reads as absent without the suggestion fields', () => {
    expect(aiCaretOf(EditorState.create({ doc: DOC }))).toBeNull()
  })
})
