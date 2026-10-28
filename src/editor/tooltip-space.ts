import type { Extension } from '@codemirror/state'
import { EditorView, tooltips } from '@codemirror/view'

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

export const coveredTop = (inset: number, editorTop: number): number =>
  Math.max(0, Math.min(inset, inset - editorTop))

const viewportOf = (view: EditorView): Viewport => {
  const root = view.dom.ownerDocument.documentElement
  return { width: root.clientWidth, height: root.clientHeight }
}

export const spaceBelowHeader = (getInset: () => number): Extension => [
  tooltips({
    tooltipSpace: (view) => spaceBelow(getInset(), viewportOf(view)),
  }),
  EditorView.scrollMargins.of((view) => ({
    top: coveredTop(getInset(), view.scrollDOM.getBoundingClientRect().top),
  })),
]
