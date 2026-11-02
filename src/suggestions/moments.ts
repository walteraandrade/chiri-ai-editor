import { findSuggestion } from './state'
import type {
  ReadySuggestion,
  Suggestion,
  SuggestionId,
  SuggestionsState,
} from './types'

const showsNewText = (
  previous: Suggestion | undefined,
  next: ReadySuggestion,
): boolean =>
  previous?.status !== 'ready' ||
  previous.replacement !== next.replacement ||
  previous.shown !== next.shown

export const revealedIds = (
  before: SuggestionsState,
  after: SuggestionsState,
): readonly SuggestionId[] =>
  after.items
    .filter(
      (item): item is ReadySuggestion =>
        item.status === 'ready' &&
        showsNewText(findSuggestion(before, item.id), item),
    )
    .map((item) => item.id)
