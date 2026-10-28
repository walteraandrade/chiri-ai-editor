import { EditorState } from '@codemirror/state'
import { showTooltip } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { interactionField } from './interaction-state'
import { refineInputField } from './refine-input'
import { suggestionCards } from './suggestion-cards'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

describe('Active Suggestion card', () => {
  it('is never clipped by CodeMirror, so the sticky header decides what hides it', () => {
    const state = EditorState.create({
      doc: DOC,
      extensions: [
        suggestionsField,
        interactionField,
        refineInputField,
        suggestionCards,
      ],
    })
      .update({
        effects: beginEffect.of({
          id: 'a',
          from: 0,
          to: 21,
          source: 'block',
          original: DOC.slice(0, 21),
          instruction: quickActionInstruction('shorter'),
        }),
      })
      .state.update({
        effects: resolveEffect.of({
          id: 'a',
          result: {
            replacement: 'First paragraph.',
            rationale: 'Shorter.',
            unchanged: false,
          },
        }),
      }).state

    const [card] = state.facet(showTooltip).filter((tooltip) => tooltip)
    expect(card).toMatchObject({ pos: 0, clip: false })
  })
})
