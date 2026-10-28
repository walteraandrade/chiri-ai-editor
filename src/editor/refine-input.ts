import {
  type EditorState,
  StateEffect,
  StateField,
  type Transaction,
} from '@codemirror/state'
import { findSuggestion } from '../suggestions/state'
import type { SuggestionId } from '../suggestions/types'
import { suggestionsField } from './suggestion-field'

export const openRefineEffect = StateEffect.define<SuggestionId>()
export const closeRefineEffect = StateEffect.define<null>()

const canRefine = (state: EditorState, id: SuggestionId): boolean => {
  const found = findSuggestion(state.field(suggestionsField), id)
  return found?.status === 'ready' && found.refine.status !== 'working'
}

const moved = (transaction: Transaction): boolean =>
  transaction.docChanged ||
  !transaction.startState.selection.main.eq(transaction.state.selection.main)

export const refineInputField = StateField.define<SuggestionId | null>({
  create: () => null,
  update: (value, transaction) => {
    const opened = transaction.effects.findLast(
      (effect): effect is StateEffect<SuggestionId> =>
        effect.is(openRefineEffect),
    )
    const closed = transaction.effects.some((effect) =>
      effect.is(closeRefineEffect),
    )
    const next = closed
      ? null
      : opened
        ? opened.value
        : moved(transaction)
          ? null
          : value
    return next !== null && canRefine(transaction.state, next) ? next : null
  },
})

export const refineInputOpenFor = (state: EditorState): SuggestionId | null =>
  state.field(refineInputField)
