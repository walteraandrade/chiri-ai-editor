import type { EditorView } from '@codemirror/view'
import { reviewActionsFacet } from './review-runtime'
import {
  acceptAllReviewSuggestions,
  rejectAllReviewSuggestions,
  revealFirstReviewSuggestion,
} from './suggestion-commands'

export type ReviewControls = {
  readonly start: (focus: string) => void
  readonly stop: () => void
  readonly acceptAll: () => void
  readonly rejectAll: () => void
}

export const bindReviewControls = (view: EditorView): ReviewControls => ({
  start: (focus) => view.state.facet(reviewActionsFacet)?.start(view, focus),
  stop: () => view.state.facet(reviewActionsFacet)?.stop(view),
  acceptAll: () => {
    acceptAllReviewSuggestions(view)
    view.focus()
  },
  rejectAll: () => {
    rejectAllReviewSuggestions(view)
    view.focus()
  },
})

export const beforeReviewChanges = (
  controls: ReviewControls,
  before: () => void,
): ReviewControls => ({
  ...controls,
  start: (focus) => {
    before()
    controls.start(focus)
  },
  acceptAll: () => {
    before()
    controls.acceptAll()
  },
  rejectAll: () => {
    before()
    controls.rejectAll()
  },
})

export const revealAfterReviewPass = (view: EditorView): boolean => {
  const working = view.dom.contains(view.dom.ownerDocument.activeElement)
  if (working || !revealFirstReviewSuggestion(view)) return false
  view.focus()
  return true
}
