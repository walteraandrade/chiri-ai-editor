import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  cardPlacementOf,
  MARGIN_CARD_WIDTH,
  marginAnchor,
  placementEffect,
  placementField,
  placementFor,
} from './card-placement'

describe('placementFor', () => {
  it('puts cards in the margin when a card, its gap and the gutter fit right of the text', () => {
    expect(placementFor(1016, 1312)).toBe('margin')
  })

  it('keeps cards floating when the margin is one pixel short', () => {
    expect(placementFor(1016, 1311)).toBe('floating')
  })

  it('keeps cards floating when the text fills the viewport', () => {
    expect(placementFor(1000, 1024)).toBe('floating')
  })
})

describe('marginAnchor', () => {
  it('starts one gap right of the text, level with the line top', () => {
    expect(marginAnchor(1016, 340)).toEqual({
      left: 1040,
      right: 1040,
      top: 340,
      bottom: 340,
    })
  })

  it('leaves room for the card inside the margin it was measured for', () => {
    const { left } = marginAnchor(1016, 0)
    expect(left + MARGIN_CARD_WIDTH).toBeLessThanOrEqual(1312 - 16)
  })
})

describe('placementField', () => {
  it('starts floating', () => {
    const state = EditorState.create({ extensions: [placementField] })
    expect(cardPlacementOf(state)).toBe('floating')
  })

  it('follows the latest placement effect', () => {
    const state = EditorState.create({ extensions: [placementField] }).update({
      effects: placementEffect.of('margin'),
    }).state
    expect(cardPlacementOf(state)).toBe('margin')
  })

  it('reads as floating when the field is not installed', () => {
    expect(cardPlacementOf(EditorState.create())).toBe('floating')
  })
})
