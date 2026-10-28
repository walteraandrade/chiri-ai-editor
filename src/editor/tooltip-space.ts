import type { Extension } from '@codemirror/state'
import { type EditorView, tooltips } from '@codemirror/view'

type Viewport = { readonly width: number; readonly height: number }

export type TooltipSpace = {
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

export const spaceBelow = (
  inset: number,
  viewport: Viewport,
): TooltipSpace => ({
  top: Math.max(0, inset),
  left: 0,
  right: viewport.width,
  bottom: viewport.height,
})

const viewportOf = (view: EditorView): Viewport => {
  const win = view.dom.ownerDocument.defaultView
  return { width: win?.innerWidth ?? 0, height: win?.innerHeight ?? 0 }
}

export const tooltipSpaceBelow = (getInset: () => number): Extension =>
  tooltips({
    tooltipSpace: (view) => spaceBelow(getInset(), viewportOf(view)),
  })
