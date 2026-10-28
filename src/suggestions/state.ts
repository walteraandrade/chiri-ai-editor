import type { ChangeDesc } from '@codemirror/state'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import { adaptiveDiff } from '../diff/adaptive-diff'
import { matchEdgeWhitespace } from './replacement'
import type {
  Instruction,
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
      {
        ...draft,
        origin: draft.origin ?? 'ask',
        status: 'pending',
        sequence: state.nextSequence,
      },
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
    history: [
      {
        instruction: found.instruction,
        replacement,
        rationale: result.rationale,
      },
    ],
    refine: { status: 'idle' },
  }
  return replaceItem(state, ready)
}

const findReady = (
  state: SuggestionsState,
  id: SuggestionId,
): ReadySuggestion | undefined => {
  const found = findSuggestion(state, id)
  return found?.status === 'ready' ? found : undefined
}

export const beginRefine = (
  state: SuggestionsState,
  id: SuggestionId,
  instruction: Instruction,
): SuggestionsState => {
  const found = findReady(state, id)
  return found === undefined || found.refine.status === 'working'
    ? state
    : replaceItem(state, {
        ...found,
        refine: { status: 'working', instruction },
      })
}

export const resolveRefine = (
  state: SuggestionsState,
  id: SuggestionId,
  result: SuggestionResult,
): SuggestionsState => {
  const found = findReady(state, id)
  if (found?.refine.status !== 'working') return state
  const replacement = matchEdgeWhitespace(found.original, result.replacement)
  if (result.unchanged || replacement === found.replacement) {
    return withNotice(
      replaceItem(state, { ...found, refine: { status: 'idle' } }),
      'no-change',
    )
  }
  return replaceItem(state, {
    ...found,
    replacement,
    rationale: result.rationale,
    diff: adaptiveDiff(found.original, replacement),
    history: [
      ...found.history,
      {
        instruction: found.refine.instruction,
        replacement,
        rationale: result.rationale,
      },
    ],
    refine: { status: 'idle' },
  })
}

export const failRefine = (
  state: SuggestionsState,
  id: SuggestionId,
  error: ClientError,
): SuggestionsState => {
  const found = findReady(state, id)
  return found?.refine.status === 'working'
    ? replaceItem(state, {
        ...found,
        refine: {
          status: 'failed',
          instruction: found.refine.instruction,
          error,
        },
      })
    : state
}

export const retryRefine = (
  state: SuggestionsState,
  id: SuggestionId,
): SuggestionsState => {
  const found = findReady(state, id)
  return found?.refine.status === 'failed'
    ? replaceItem(state, {
        ...found,
        refine: { status: 'working', instruction: found.refine.instruction },
      })
    : state
}

export const cancelRefine = (
  state: SuggestionsState,
  id: SuggestionId,
): SuggestionsState => {
  const found = findReady(state, id)
  return found === undefined || found.refine.status === 'idle'
    ? state
    : replaceItem(state, { ...found, refine: { status: 'idle' } })
}

export const instructionHistory = (
  suggestion: ReadySuggestion,
): readonly string[] => suggestion.history.map((step) => step.instruction.text)

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

export const rejectSuggestions = (
  state: SuggestionsState,
  ids: readonly SuggestionId[],
): SuggestionsState => {
  const items = state.items.filter((item) => !ids.includes(item.id))
  return items.length === state.items.length ? state : { ...state, items }
}

export const rejectReviewSuggestions = (
  state: SuggestionsState,
): SuggestionsState => {
  const items = state.items.filter((item) => item.origin !== 'review')
  return items.length === state.items.length ? state : { ...state, items }
}

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

export const acceptSuggestions = (
  state: SuggestionsState,
  ids: readonly SuggestionId[],
  changes: ChangeDesc,
): SuggestionsState => mapSuggestions(rejectSuggestions(state, ids), changes)

export const acceptSuggestion = (
  state: SuggestionsState,
  id: SuggestionId,
  changes: ChangeDesc,
): SuggestionsState => acceptSuggestions(state, [id], changes)

const isInFlight = (item: Suggestion): boolean =>
  item.status === 'pending' ||
  (item.status === 'ready' && item.refine.status === 'working')

export const inFlightSuggestionIds = (
  state: SuggestionsState,
): readonly SuggestionId[] =>
  state.items.filter(isInFlight).map((item) => item.id)

const contains = (item: Suggestion, position: number): boolean =>
  item.from <= position && position <= item.to

const pickBy =
  (better: (candidate: number, best: number) => boolean) =>
  <T extends Suggestion>(items: readonly T[]): T | undefined =>
    items.reduce<T | undefined>(
      (best, item) =>
        best === undefined || better(item.sequence, best.sequence)
          ? item
          : best,
      undefined,
    )

const mostRecent = pickBy((candidate, best) => candidate > best)
const oldest = pickBy((candidate, best) => candidate < best)

export const activeSuggestion = (
  state: SuggestionsState,
  cursor: number | null,
): ReadySuggestion | undefined => {
  const ready = state.items.filter(
    (item): item is ReadySuggestion => item.status === 'ready',
  )
  const containing =
    cursor === null ? [] : ready.filter((item) => contains(item, cursor))
  return (
    mostRecent(containing) ??
    mostRecent(ready.filter((item) => item.origin !== 'review')) ??
    oldest(ready)
  )
}

export const suggestionAt = (
  state: SuggestionsState,
  position: number,
): Suggestion | undefined =>
  mostRecent(state.items.filter((item) => contains(item, position)))
