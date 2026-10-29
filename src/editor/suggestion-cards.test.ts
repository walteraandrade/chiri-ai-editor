import { EditorState, type StateEffect } from '@codemirror/state'
import { showTooltip, type Tooltip } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import {
  freeTextInstruction,
  quickActionInstruction,
} from '../suggestions/instruction'
import { placementEffect, placementField } from './card-placement'
import { hoverEffect, interactionField } from './interaction-state'
import { refineInputField } from './refine-input'
import { contentFor, suggestionCards } from './suggestion-cards'
import {
  beginEffect,
  beginRefineEffect,
  resolveEffect,
  resolveRefineEffect,
  showVersionEffect,
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

describe('version arrows', () => {
  const FORMAL = freeTextInstruction('now more formal')

  const refined = (id = 'a'): readonly StateEffect<unknown>[] => [
    beginRefineEffect.of({ id, instruction: FORMAL }),
    resolveRefineEffect.of({
      id,
      result: {
        replacement: 'The first paragraph.',
        rationale: 'Formal.',
        unchanged: false,
      },
    }),
  ]

  it('are absent with a single step', () => {
    expect(contentFor('active', stateWith(0))?.version).toBeNull()
  })

  it('show from 2 steps, on the newest step with its Instruction', () => {
    expect(contentFor('active', stateWith(0, refined()))?.version).toEqual({
      index: 1,
      count: 2,
      instruction: 'now more formal',
      locked: false,
    })
  })

  it('follow the shown step', () => {
    const state = stateWith(0, [
      ...refined(),
      showVersionEffect.of({ id: 'a', index: 0 }),
    ])
    expect(contentFor('active', state)).toMatchObject({
      version: { index: 0, count: 2, instruction: 'Shorter' },
      suggestion: { replacement: 'First paragraph.', rationale: 'Shorter.' },
    })
  })

  it('are locked while a Refine is in flight', () => {
    const state = stateWith(0, [
      ...refined(),
      beginRefineEffect.of({ id: 'a', instruction: FORMAL }),
    ])
    expect(contentFor('active', state)?.version?.locked).toBe(true)
  })

  it('stay off the hover card', () => {
    const state = stateWith(0, [
      beginEffect.of({
        id: 'b',
        from: 23,
        to: 45,
        source: 'block',
        original: DOC.slice(23),
        instruction: quickActionInstruction('shorter'),
      }),
      resolveEffect.of({
        id: 'b',
        result: {
          replacement: 'Second one.',
          rationale: 'Shorter.',
          unchanged: false,
        },
      }),
      ...refined('b'),
      hoverEffect.of('b'),
    ])
    expect(contentFor('hover', state)).toMatchObject({
      suggestion: { id: 'b' },
      version: null,
    })
  })
})
