import { type EditorState, StateEffect, StateField } from '@codemirror/state'
import { type EditorView, type Rect, ViewPlugin } from '@codemirror/view'
import { viewportOf } from './tooltip-space'

export type CardPlacement = 'margin' | 'floating'

export const MARGIN_CARD_WIDTH = 256
const MARGIN_GAP = 24
const VIEWPORT_GUTTER = 16

export const placementFor = (
  contentRight: number,
  viewportWidth: number,
): CardPlacement =>
  viewportWidth - contentRight >=
  MARGIN_GAP + MARGIN_CARD_WIDTH + VIEWPORT_GUTTER
    ? 'margin'
    : 'floating'

export const marginAnchor = (contentRight: number, lineTop: number): Rect => ({
  left: contentRight + MARGIN_GAP,
  right: contentRight + MARGIN_GAP,
  top: lineTop,
  bottom: lineTop,
})

export const placementEffect = StateEffect.define<CardPlacement>()

export const placementField = StateField.define<CardPlacement>({
  create: () => 'floating',
  update: (value, transaction) =>
    transaction.effects.reduce<CardPlacement>(
      (placement, effect) =>
        effect.is(placementEffect) ? effect.value : placement,
      value,
    ),
})

export const cardPlacementOf = (state: EditorState): CardPlacement =>
  state.field(placementField, false) ?? 'floating'

const contentRightOf = (view: EditorView): number =>
  view.contentDOM.getBoundingClientRect().right

export const marginAnchorAt = (view: EditorView, pos: number): Rect =>
  marginAnchor(
    contentRightOf(view),
    view.coordsAtPos(pos)?.top ?? view.documentTop + view.lineBlockAt(pos).top,
  )

const placementPlugin = ViewPlugin.define((view: EditorView) => {
  const sync = (): void => {
    if (!view.dom.isConnected) return
    const next = placementFor(contentRightOf(view), viewportOf(view).width)
    if (next !== cardPlacementOf(view.state))
      view.dispatch({ effects: placementEffect.of(next) })
  }
  const observer = new ResizeObserver(sync)
  observer.observe(view.dom.ownerDocument.documentElement)
  return { destroy: () => observer.disconnect() }
})

export const cardPlacement = [placementField, placementPlugin]
