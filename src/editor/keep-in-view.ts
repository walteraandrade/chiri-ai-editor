import { EditorView, type Rect } from '@codemirror/view'
import { viewportOf } from './tooltip-space'

type Band = { readonly top: number; readonly bottom: number }

type Range = { readonly from: number; readonly to: number }

const EDGE_GAP = 8

export const keepInBand = ({
  anchor,
  range,
  band,
  left,
}: {
  readonly anchor: Rect
  readonly range: Band
  readonly band: Band
  readonly left: number
}): Rect => {
  const below = anchor.bottom > band.bottom
  const above = anchor.top < band.top
  const rangeOnScreen = range.top < band.bottom && range.bottom > band.top
  if ((!below && !above) || !rangeOnScreen) return anchor
  const y = below ? band.bottom - EDGE_GAP : band.top + EDGE_GAP
  return { left, right: left, top: y, bottom: y }
}

export const lineRectAt = (
  view: EditorView,
  pos: number,
  left: number,
): Rect => {
  const block = view.lineBlockAt(pos)
  return {
    left,
    right: left,
    top: view.documentTop + block.top,
    bottom: view.documentTop + block.bottom,
  }
}

const rectAt = (view: EditorView, pos: number, left: number): Rect =>
  view.coordsAtPos(pos) ?? lineRectAt(view, pos, left)

const visibleBand = (view: EditorView): Band => {
  const scroller = view.scrollDOM.getBoundingClientRect()
  const insets = view.state
    .facet(EditorView.scrollMargins)
    .map((margins) => margins(view)?.top ?? 0)
  return {
    top: Math.max(scroller.top, ...insets),
    bottom: Math.min(scroller.bottom, viewportOf(view).height),
  }
}

export const inViewCoords = (
  view: EditorView,
  anchor: Rect,
  { from, to }: Range,
  left = anchor.left,
): Rect =>
  keepInBand({
    anchor,
    range: {
      top: rectAt(view, from, left).top,
      bottom: rectAt(view, to, left).bottom,
    },
    band: visibleBand(view),
    left,
  })
