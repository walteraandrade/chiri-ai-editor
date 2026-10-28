import { EditorState, type StateEffect } from '@codemirror/state'
import { showTooltip } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import {
  askBubble,
  bubblePlacement,
  bubbleVisible,
  dismissBubbleEffect,
  openAskEffect,
  targetPreviewRange,
} from './ask-bubble'
import {
  focusEffect,
  interactionField,
  pointerEffect,
} from './interaction-state'
import { beginEffect, suggestionsField } from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const create = (anchor: number, head = anchor): EditorState =>
  EditorState.create({
    doc: DOC,
    selection: { anchor, head },
    extensions: [suggestionsField, interactionField, askBubble],
  })

const apply = (
  state: EditorState,
  ...effects: readonly StateEffect<unknown>[]
): EditorState => state.update({ effects }).state

const focused = (state: EditorState): EditorState =>
  apply(state, focusEffect.of(true))

describe('selection bubble', () => {
  it('stays hidden without focus, with an empty selection, or on whitespace', () => {
    expect(bubbleVisible(create(2, 8))).toBe(false)
    expect(bubbleVisible(focused(create(2)))).toBe(false)
    expect(bubbleVisible(focused(create(21, 23)))).toBe(false)
  })

  it('shows for a non-empty selection while the editor is focused', () => {
    expect(bubbleVisible(focused(create(2, 8)))).toBe(true)
  })

  it('hides while the pointer is down and shows again on release', () => {
    const dragging = apply(focused(create(2, 8)), pointerEffect.of(true))
    expect(bubbleVisible(dragging)).toBe(false)
    expect(bubbleVisible(apply(dragging, pointerEffect.of(false)))).toBe(true)
  })

  it('stays dismissed for the same selection and returns when it changes', () => {
    const dismissed = apply(focused(create(2, 8)), dismissBubbleEffect.of(null))
    expect(bubbleVisible(dismissed)).toBe(false)
    expect(
      bubbleVisible(
        dismissed.update({ selection: { anchor: 2, head: 9 } }).state,
      ),
    ).toBe(true)
  })

  it('keeps the dismissal aligned when text is inserted before the selection', () => {
    const dismissed = apply(focused(create(2, 8)), dismissBubbleEffect.of(null))
    const shifted = dismissed.update({
      changes: { from: 0, insert: 'XX' },
    }).state
    expect(bubbleVisible(shifted)).toBe(false)
  })

  it('hides once a request starts on the selection', () => {
    const state = focused(create(0, 21))
    const started = apply(
      state,
      beginEffect.of({
        id: 'a',
        from: 0,
        to: 21,
        source: 'selection',
        original: DOC.slice(0, 21),
        instruction: quickActionInstruction('shorter'),
      }),
    )
    expect(bubbleVisible(started)).toBe(false)
  })
})

describe('bubble placement', () => {
  it('sits below the end of a selection extended downward', () => {
    expect(bubblePlacement(create(2, 30))).toEqual({ pos: 30, above: false })
  })

  it('follows the cursor even when the selection ends in blank lines', () => {
    expect(bubblePlacement(create(2, 23))).toEqual({ pos: 23, above: false })
  })

  it('sits above the start of a selection extended upward', () => {
    expect(bubblePlacement(create(30, 2))).toEqual({ pos: 2, above: true })
  })

  it('sits above the Block when opened without a selection', () => {
    expect(bubblePlacement(create(30))).toEqual({ pos: 23, above: true })
  })

  it('has no placement without a Target', () => {
    expect(bubblePlacement(create(21, 23))).toBeUndefined()
  })

  it('is never clipped by CodeMirror, so the sticky header decides what hides it', () => {
    const [bubble] = focused(create(2, 8))
      .facet(showTooltip)
      .filter((tooltip) => tooltip)
    expect(bubble).toMatchObject({ pos: 8, clip: false })
  })
})

describe('Ctrl+K field', () => {
  it('opens with no selection and previews the Block as the Target', () => {
    const state = apply(focused(create(30)), openAskEffect.of(null))
    expect(bubbleVisible(state)).toBe(true)
    expect(targetPreviewRange(state)).toMatchObject({ from: 23, to: 45 })
  })

  it('opens over a selection without previewing a Block', () => {
    const state = apply(focused(create(2, 8)), openAskEffect.of(null))
    expect(bubbleVisible(state)).toBe(true)
    expect(targetPreviewRange(state)).toBeUndefined()
  })

  it('opens even after the selection bubble was dismissed', () => {
    const dismissed = apply(focused(create(2, 8)), dismissBubbleEffect.of(null))
    expect(bubbleVisible(apply(dismissed, openAskEffect.of(null)))).toBe(true)
  })

  it('closes when the cursor moves or the text changes', () => {
    const open = apply(focused(create(30)), openAskEffect.of(null))
    expect(bubbleVisible(open.update({ selection: { anchor: 5 } }).state)).toBe(
      false,
    )
    expect(
      bubbleVisible(open.update({ changes: { from: 0, insert: 'x' } }).state),
    ).toBe(false)
  })

  it('closes on dismiss and when a request starts', () => {
    const open = apply(focused(create(30)), openAskEffect.of(null))
    expect(bubbleVisible(apply(open, dismissBubbleEffect.of(null)))).toBe(false)
    expect(
      bubbleVisible(
        apply(
          open,
          beginEffect.of({
            id: 'a',
            from: 23,
            to: 45,
            source: 'block',
            original: DOC.slice(23, 45),
            instruction: quickActionInstruction('clearer'),
          }),
        ),
      ),
    ).toBe(false)
  })

  it('does not open on an empty Document', () => {
    const empty = EditorState.create({
      doc: '',
      extensions: [suggestionsField, interactionField, askBubble],
    })
    expect(bubbleVisible(apply(focused(empty), openAskEffect.of(null)))).toBe(
      false,
    )
  })
})
