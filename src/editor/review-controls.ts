import type { EditorView } from '@codemirror/view'
import { reviewActionsFacet } from './review-runtime'
import {
  acceptAllReviewSuggestions,
  rejectAllReviewSuggestions,
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
