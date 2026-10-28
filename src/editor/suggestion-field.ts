import { type EditorState, StateEffect, StateField } from '@codemirror/state'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import {
  acceptSuggestion,
  activeSuggestion,
  beginRefine,
  beginSuggestion,
  cancelRefine,
  emptySuggestions,
  failRefine,
  failSuggestion,
  mapSuggestions,
  rejectSuggestion,
  resolveRefine,
  resolveSuggestion,
  retryRefine,
  retrySuggestion,
  suggestionAt,
} from '../suggestions/state'
import type {
  Instruction,
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
export const beginRefineEffect = StateEffect.define<{
  readonly id: SuggestionId
  readonly instruction: Instruction
}>()
export const resolveRefineEffect = StateEffect.define<{
  readonly id: SuggestionId
  readonly result: SuggestionResult
}>()
export const failRefineEffect = StateEffect.define<{
  readonly id: SuggestionId
  readonly error: ClientError
}>()
export const retryRefineEffect = StateEffect.define<SuggestionId>()
export const cancelRefineEffect = StateEffect.define<SuggestionId>()
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
  if (effect.is(beginRefineEffect))
    return beginRefine(state, effect.value.id, effect.value.instruction)
  if (effect.is(resolveRefineEffect))
    return resolveRefine(state, effect.value.id, effect.value.result)
  if (effect.is(failRefineEffect))
    return failRefine(state, effect.value.id, effect.value.error)
  if (effect.is(retryRefineEffect)) return retryRefine(state, effect.value)
  if (effect.is(cancelRefineEffect)) return cancelRefine(state, effect.value)
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

export const activeAtCursor = (
  state: EditorState,
): ReadySuggestion | undefined => {
  const active = activeOf(state)
  const { head } = state.selection.main
  return active !== undefined && active.from <= head && head <= active.to
    ? active
    : undefined
}

export const suggestionAtCursor = (
  state: EditorState,
): Suggestion | undefined => suggestionAt(suggestionsOf(state), cursorOf(state))
