import type { ChangeDesc } from '@codemirror/state'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import { adaptiveDiff } from '../diff/adaptive-diff'
import { matchEdgeWhitespace } from './replacement'
import type {
  NoticeKind,
  ReadySuggestion,
  Suggestion,
  SuggestionDraft,
  SuggestionId,
  SuggestionsState,
} from './types'

export const emptySuggestions: SuggestionsState = {
  items: [],
  nextSequence: 0,
  notice: null,
}

const withNotice = (
  state: SuggestionsState,
  kind: NoticeKind,
): SuggestionsState => ({
  ...state,
  notice: { serial: (state.notice?.serial ?? 0) + 1, kind },
})

const without = (
  state: SuggestionsState,
  id: SuggestionId,
): SuggestionsState => ({
  ...state,
  items: state.items.filter((item) => item.id !== id),
})

const replaceItem = (
  state: SuggestionsState,
  next: Suggestion,
): SuggestionsState => ({
  ...state,
  items: state.items.map((item) => (item.id === next.id ? next : item)),
})

export const findSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
): Suggestion | undefined => state.items.find((item) => item.id === id)

const overlaps = (
  item: Suggestion,
  range: { readonly from: number; readonly to: number },
): boolean => item.from < range.to && range.from < item.to

export const beginSuggestion = (
  state: SuggestionsState,
  draft: SuggestionDraft,
): SuggestionsState => {
  const survivors = state.items.filter((item) => !overlaps(item, draft))
  const replaced = survivors.length !== state.items.length
  const next: SuggestionsState = {
    ...state,
    items: [
      ...survivors,
      { ...draft, status: 'pending', sequence: state.nextSequence },
    ],
    nextSequence: state.nextSequence + 1,
  }
  return replaced ? withNotice(next, 'replaced') : next
}

export const resolveSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
  result: SuggestionResult,
): SuggestionsState => {
  const found = findSuggestion(state, id)
  if (found?.status !== 'pending') return state
  if (result.unchanged) return withNotice(without(state, id), 'no-change')
  const replacement = matchEdgeWhitespace(found.original, result.replacement)
  const ready: ReadySuggestion = {
    ...found,
    status: 'ready',
    replacement,
    rationale: result.rationale,
    diff: adaptiveDiff(found.original, replacement),
    history: [],
  }
  return replaceItem(state, ready)
}

export const failSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
  error: ClientError,
): SuggestionsState => {
  const found = findSuggestion(state, id)
  return found?.status === 'pending'
    ? replaceItem(state, { ...found, status: 'error', error })
    : state
}

export const retrySuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
): SuggestionsState => {
  const found = findSuggestion(state, id)
  if (found?.status !== 'error') return state
  const { error: _error, ...base } = found
  return replaceItem(state, { ...base, status: 'pending' })
}

export const rejectSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
): SuggestionsState =>
  findSuggestion(state, id) === undefined ? state : without(state, id)

export const discardSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
  kind: Extract<NoticeKind, 'text-changed' | 'replaced'>,
): SuggestionsState =>
  findSuggestion(state, id) === undefined
    ? state
    : withNotice(without(state, id), kind)

const touchesInterior = (item: Suggestion, changes: ChangeDesc): boolean => {
  let touched = false
  changes.iterChangedRanges((fromA, toA) => {
    if (fromA < item.to && toA > item.from) touched = true
  })
  return touched
}

export const mapSuggestions = (
  state: SuggestionsState,
  changes: ChangeDesc,
): SuggestionsState => {
  if (changes.empty || state.items.length === 0) return state
  const survivors = state.items.filter(
    (item) => !touchesInterior(item, changes),
  )
  const mapped = survivors.map(
    (item): Suggestion => ({
      ...item,
      from: changes.mapPos(item.from, 1),
      to: changes.mapPos(item.to, -1),
    }),
  )
  const next: SuggestionsState = { ...state, items: mapped }
  return survivors.length === state.items.length
    ? next
    : withNotice(next, 'text-changed')
}

export const acceptSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
  changes: ChangeDesc,
): SuggestionsState => mapSuggestions(without(state, id), changes)

export const pendingSuggestionIds = (
  state: SuggestionsState,
): readonly SuggestionId[] =>
  state.items.filter((item) => item.status === 'pending').map((item) => item.id)

const contains = (item: Suggestion, position: number): boolean =>
  item.from <= position && position <= item.to

const mostRecent = <T extends Suggestion>(items: readonly T[]): T | undefined =>
  items.reduce<T | undefined>(
    (best, item) =>
      best === undefined || item.sequence > best.sequence ? item : best,
    undefined,
  )

export const activeSuggestion = (
  state: SuggestionsState,
  cursor: number | null,
): ReadySuggestion | undefined => {
  const ready = state.items.filter(
    (item): item is ReadySuggestion => item.status === 'ready',
  )
  const containing =
    cursor === null ? [] : ready.filter((item) => contains(item, cursor))
  return mostRecent(containing) ?? mostRecent(ready)
}

export const suggestionAt = (
  state: SuggestionsState,
  position: number,
): Suggestion | undefined =>
  mostRecent(state.items.filter((item) => contains(item, position)))
