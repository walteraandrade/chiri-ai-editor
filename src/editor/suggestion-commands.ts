import { isolateHistory } from '@codemirror/commands'
import type { EditorState, TransactionSpec } from '@codemirror/state'
import { acceptAllPlan, openReviewCount } from '../suggestions/review'
import { findSuggestion } from '../suggestions/state'
import type { SuggestionId } from '../suggestions/types'
import {
  acceptEffect,
  acceptManyEffect,
  rejectEffect,
  rejectReviewEffect,
  suggestionAtCursor,
  suggestionsOf,
} from './suggestion-field'

export type EditorHandle = {
  readonly state: EditorState
  readonly dispatch: (spec: TransactionSpec) => void
}

export const acceptSuggestionById = (
  handle: EditorHandle,
  id: SuggestionId,
): boolean => {
  const found = findSuggestion(suggestionsOf(handle.state), id)
  if (found?.status !== 'ready') return false
  handle.dispatch({
    changes: { from: found.from, to: found.to, insert: found.replacement },
    selection: { anchor: found.from + found.replacement.length },
    effects: acceptEffect.of(found.id),
    annotations: isolateHistory.of('full'),
    userEvent: 'input.accept',
    scrollIntoView: true,
  })
  return true
}

export const rejectSuggestionById = (
  handle: EditorHandle,
  id: SuggestionId,
): boolean => {
  if (findSuggestion(suggestionsOf(handle.state), id) === undefined)
    return false
  handle.dispatch({ effects: rejectEffect.of(id) })
  return true
}

export const acceptAllReviewSuggestions = (handle: EditorHandle): boolean => {
  const { ids, changes } = acceptAllPlan(suggestionsOf(handle.state))
  if (ids.length === 0) return false
  handle.dispatch({
    changes: [...changes],
    effects: acceptManyEffect.of(ids),
    annotations: isolateHistory.of('full'),
    userEvent: 'input.accept',
  })
  return true
}

export const rejectAllReviewSuggestions = (handle: EditorHandle): boolean => {
  if (openReviewCount(suggestionsOf(handle.state)) === 0) return false
  handle.dispatch({ effects: rejectReviewEffect.of(null) })
  return true
}

export const acceptAtCursor = (handle: EditorHandle): boolean => {
  const found = suggestionAtCursor(handle.state)
  if (found === undefined) return false
  if (found.status === 'ready') acceptSuggestionById(handle, found.id)
  return true
}

export const rejectAtCursor = (handle: EditorHandle): boolean => {
  const found = suggestionAtCursor(handle.state)
  return found === undefined ? false : rejectSuggestionById(handle, found.id)
}
