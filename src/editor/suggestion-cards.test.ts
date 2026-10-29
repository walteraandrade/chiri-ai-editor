import { EditorState, type StateEffect } from '@codemirror/state'
import { showTooltip, type Tooltip } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import { placementEffect, placementField } from './card-placement'
import { interactionField } from './interaction-state'
import { refineInputField } from './refine-input'
import { contentFor, suggestionCards } from './suggestion-cards'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'
const OUTSIDE = 30

const stateWith = (
  anchor: number,
  effects: readonly StateEffect<unknown>[] = [],
): EditorState =>
  EditorState.create({
    doc: DOC,
    selection: { anchor },
    extensions: [
      suggestionsField,
      interactionField,
      refineInputField,
      placementField,
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
    })
    .state.update({ effects: [...effects] }).state

const activeCard = (state: EditorState): Tooltip | undefined =>
  state.facet(showTooltip).find((tooltip) => tooltip !== null) ?? undefined

describe('Active Suggestion card', () => {
  it('floats above its Suggestion when the margin has no room, never clipped by CodeMirror, so the sticky header decides what hides it', () => {
    expect(activeCard(stateWith(0))).toMatchObject({
      pos: 0,
      above: true,
      clip: false,
    })
  })

  it('hangs from the line top in the margin, on a fixed side', () => {
    const card = activeCard(stateWith(0, [placementEffect.of('margin')]))
    expect(card).toMatchObject({ above: false, strictSide: true })
  })

  it('is rebuilt when the placement changes, so CodeMirror resets its side', () => {
    const floating = activeCard(stateWith(0))
    const margin = activeCard(stateWith(0, [placementEffect.of('margin')]))
    expect(margin?.create).not.toBe(floating?.create)
  })

  it('hides the Rationale while floating if the cursor is outside and nothing is hovered', () => {
    expect(contentFor('active', stateWith(OUTSIDE))).toMatchObject({
      showRationale: false,
    })
  })

  it('always shows the Rationale in the margin', () => {
    const state = stateWith(OUTSIDE, [placementEffect.of('margin')])
    expect(contentFor('active', state)).toMatchObject({
      showRationale: true,
      showActions: true,
    })
  })
})
