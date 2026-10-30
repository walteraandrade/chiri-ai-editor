import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { ModelClient } from '../ai/client'
import { describeError } from '../suggestions/error-message'
import { findSuggestion, newlyFailed } from '../suggestions/state'
import type { FailedSuggestion, SuggestionNotice } from '../suggestions/types'
import { askBubble } from './ask-bubble'
import { cardPlacement } from './card-placement'
import { interactionState } from './interaction-state'
import { refineInputField } from './refine-input'
import {
  type ReviewStatus,
  reviewStatusOf,
  sameReviewStatus,
} from './review-field'
import {
  createReviewRuntime,
  type ReviewDrop,
  type ReviewNotice,
} from './review-runtime'
import { suggestionCards } from './suggestion-cards'
import { suggestionDecorations } from './suggestion-decorations'
import { suggestionsField, suggestionsOf } from './suggestion-field'
import { suggestionKeymap } from './suggestion-keymap'
import {
  createSuggestionRuntime,
  suggestionActionsFacet,
} from './suggestion-runtime'

export type FailureNotice = {
  readonly text: string
  readonly retry: () => void
  readonly show: () => void
}

const failureNotice = (
  view: EditorView,
  { id, error }: FailedSuggestion,
): FailureNotice => ({
  text: describeError(error),
  retry: () => {
    view.state.facet(suggestionActionsFacet)?.retry(view, id)
    view.focus()
  },
  show: () => {
    const found = findSuggestion(suggestionsOf(view.state), id)
    if (found === undefined) return
    view.dispatch({
      effects: EditorView.scrollIntoView(found.to, { y: 'center' }),
    })
  },
})

export type ReviewObserver = {
  readonly onStatus: (status: ReviewStatus) => void
  readonly onNotice: (notice: ReviewNotice) => void
  readonly onDrop?: (drop: ReviewDrop) => void
}

type SuggestionExtensionOptions = {
  readonly client: Pick<
    ModelClient,
    'requestSuggestion' | 'refineSuggestion' | 'reviewDocument'
  >
  readonly onNotice: (notice: SuggestionNotice) => void
  readonly onFailure: (notice: FailureNotice) => void
  readonly review: ReviewObserver
}

export const suggestionExtensions = ({
  client,
  onNotice,
  onFailure,
  review,
}: SuggestionExtensionOptions): readonly Extension[] => [
  suggestionsField,
  interactionState,
  askBubble,
  refineInputField,
  createSuggestionRuntime({ client }).extension,
  createReviewRuntime({
    client,
    onNotice: review.onNotice,
    onDrop: review.onDrop,
  }).extension,
  suggestionDecorations,
  cardPlacement,
  suggestionCards,
  suggestionKeymap,
  EditorView.updateListener.of((update) => {
    const before = suggestionsOf(update.startState).notice
    const after = suggestionsOf(update.state).notice
    if (after && after.serial !== before?.serial) onNotice(after)
  }),
  EditorView.updateListener.of((update) => {
    const failed = newlyFailed(
      suggestionsOf(update.startState),
      suggestionsOf(update.state),
    )
    for (const suggestion of failed)
      onFailure(failureNotice(update.view, suggestion))
  }),
  EditorView.updateListener.of((update) => {
    const before = reviewStatusOf(update.startState)
    const after = reviewStatusOf(update.state)
    if (!sameReviewStatus(before, after)) review.onStatus(after)
  }),
]
