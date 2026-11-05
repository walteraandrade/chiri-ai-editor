import { invertedEffects } from '@codemirror/commands'
import { type EditorState, StateEffect, StateField } from '@codemirror/state'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import {
  acceptSuggestions,
  activeSuggestion,
  beginRefine,
  beginSuggestion,
  cancelRefine,
  clearSuggestions,
  emptySuggestions,
  failRefine,
  failSuggestion,
  findSuggestion,
  mapSuggestions,
  rejectReviewSuggestions,
  rejectSuggestion,
  resolveRefine,
  resolveSuggestion,
  restoreSuggestion,
  retryRefine,
  retrySuggestion,
  showVersion,
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
import { frontmatterOfDoc } from './current-target'

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
export const showVersionEffect = StateEffect.define<{
  readonly id: SuggestionId
  readonly index: number
}>()
export const rejectEffect = StateEffect.define<SuggestionId>()
export const acceptEffect = StateEffect.define<SuggestionId>()
export const acceptManyEffect = StateEffect.define<readonly SuggestionId[]>()
export const rejectReviewEffect = StateEffect.define<null>()
export const restoreEffect = StateEffect.define<ReadySuggestion>({
  map: (suggestion, changes) => ({
    ...suggestion,
    from: changes.mapPos(suggestion.from, 1),
    to: changes.mapPos(suggestion.to, -1),
  }),
})
export const clearSuggestionsEffect = StateEffect.define<null>()

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
  if (effect.is(showVersionEffect))
    return showVersion(state, effect.value.id, effect.value.index)
  if (effect.is(rejectEffect)) return rejectSuggestion(state, effect.value)
  if (effect.is(rejectReviewEffect)) return rejectReviewSuggestions(state)
  if (effect.is(clearSuggestionsEffect)) return clearSuggestions(state)
  return state
}

const fieldRef = (): StateField<SuggestionsState> => suggestionsField

const undoableReject = invertedEffects.of((transaction) =>
  transaction.effects.flatMap((effect): StateEffect<unknown>[] => {
    if (effect.is(restoreEffect)) return [rejectEffect.of(effect.value.id)]
    if (!effect.is(rejectEffect)) return []
    const found = findSuggestion(
      transaction.startState.field(fieldRef()),
      effect.value,
    )
    return found?.status === 'ready' ? [restoreEffect.of(found)] : []
  }),
)

export const suggestionsField: StateField<SuggestionsState> =
  StateField.define<SuggestionsState>({
    create: () => emptySuggestions,
    update: (value, transaction) => {
      const acceptedIds = transaction.effects.flatMap((effect) =>
        effect.is(acceptEffect)
          ? [effect.value]
          : effect.is(acceptManyEffect)
            ? effect.value
            : [],
      )
      const frontmatter =
        transaction.docChanged && value.items.length > 0
          ? frontmatterOfDoc(transaction.newDoc)
          : undefined
      const mapped =
        acceptedIds.length > 0
          ? acceptSuggestions(
              value,
              acceptedIds,
              transaction.changes,
              frontmatter,
            )
          : mapSuggestions(value, transaction.changes, frontmatter)
      return transaction.effects.reduce(
        (state, effect) =>
          effect.is(restoreEffect)
            ? restoreSuggestion(
                state,
                effect.value,
                transaction.newDoc.sliceString(
                  effect.value.from,
                  effect.value.to,
                ),
              )
            : applyEffect(state, effect),
        mapped,
      )
    },
    provide: () => undoableReject,
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
