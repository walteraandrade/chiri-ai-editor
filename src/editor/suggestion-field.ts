import { type EditorState, StateEffect, StateField } from '@codemirror/state'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import {
  acceptSuggestion,
  activeSuggestion,
  beginSuggestion,
  emptySuggestions,
  failSuggestion,
  mapSuggestions,
  rejectSuggestion,
  resolveSuggestion,
  retrySuggestion,
  suggestionAt,
} from '../suggestions/state'
import type {
  ReadySuggestion,
  Suggestion,
  SuggestionDraft,
  SuggestionId,
  SuggestionsState,
} from '../suggestions/types'

export const beginEffect = StateEffect.define<SuggestionDraft>()
export const resolveEffect = StateEffect.define<{
  readonly id: SuggestionId
  readonly result: SuggestionResult
}>()
export const failEffect = StateEffect.define<{
  readonly id: SuggestionId
  readonly error: ClientError
}>()
export const retryEffect = StateEffect.define<SuggestionId>()
export const rejectEffect = StateEffect.define<SuggestionId>()
export const acceptEffect = StateEffect.define<SuggestionId>()

const applyEffect = (
  state: SuggestionsState,
  effect: StateEffect<unknown>,
): SuggestionsState => {
  if (effect.is(beginEffect)) return beginSuggestion(state, effect.value)
  if (effect.is(resolveEffect))
    return resolveSuggestion(state, effect.value.id, effect.value.result)
  if (effect.is(failEffect))
    return failSuggestion(state, effect.value.id, effect.value.error)
  if (effect.is(retryEffect)) return retrySuggestion(state, effect.value)
  if (effect.is(rejectEffect)) return rejectSuggestion(state, effect.value)
  return state
}

export const suggestionsField = StateField.define<SuggestionsState>({
  create: () => emptySuggestions,
  update: (value, transaction) => {
    const accepted = transaction.effects.find((effect) =>
      effect.is(acceptEffect),
    )
    const mapped = accepted
      ? acceptSuggestion(value, accepted.value, transaction.changes)
      : mapSuggestions(value, transaction.changes)
    return transaction.effects.reduce(applyEffect, mapped)
  },
})

export const suggestionsOf = (state: EditorState): SuggestionsState =>
  state.field(suggestionsField)

export const cursorOf = (state: EditorState): number =>
  state.selection.main.head

export const activeOf = (state: EditorState): ReadySuggestion | undefined =>
  activeSuggestion(suggestionsOf(state), cursorOf(state))

export const suggestionAtCursor = (
  state: EditorState,
): Suggestion | undefined => suggestionAt(suggestionsOf(state), cursorOf(state))
