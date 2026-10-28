import type { ChangeDesc } from '@codemirror/state'
import type { SuggestionResult, ValidatedEdit } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import type { Block } from '../blocks/extract-blocks'
import { describeError } from './error-message'
import type {
  Instruction,
  ReadySuggestion,
  SuggestionDraft,
  SuggestionId,
  SuggestionsState,
} from './types'

export const DEFAULT_REVIEW_FOCUS =
  'Review for clarity, concision, grammar and tone consistency.'

export const reviewInstruction = (focus: string): Instruction => ({
  type: 'free-text',
  text: focus.trim() === '' ? DEFAULT_REVIEW_FOCUS : focus.trim(),
})

type Range = { readonly from: number; readonly to: number }

const overlaps = (a: Range, b: Range): boolean => a.from < b.to && b.from < a.to

export const occupiedBlockIds = (
  state: SuggestionsState,
  blocks: readonly Block[],
): ReadonlySet<string> =>
  new Set(
    blocks
      .filter((block) => state.items.some((item) => overlaps(item, block)))
      .map((block) => block.id),
  )

const touchesInterior = (range: Range, changes: ChangeDesc): boolean => {
  let touched = false
  changes.iterChangedRanges((fromA, toA) => {
    if (fromA < range.to && toA > range.from) touched = true
  })
  return touched
}

export const mapBlockRange = (
  block: Range,
  changes: ChangeDesc,
): Range | null =>
  touchesInterior(block, changes)
    ? null
    : { from: changes.mapPos(block.from, 1), to: changes.mapPos(block.to, -1) }

export type PlaceReviewEditInput = {
  readonly state: SuggestionsState
  readonly edit: ValidatedEdit
  readonly changes: ChangeDesc
  readonly doc: string
  readonly id: SuggestionId
  readonly focus: string
}

export type ReviewPlacement =
  | {
      readonly type: 'placed'
      readonly draft: SuggestionDraft
      readonly result: SuggestionResult
    }
  | {
      readonly type: 'dropped'
      readonly reason: 'text-changed' | 'occupied'
    }

export const placeReviewEdit = ({
  state,
  edit,
  changes,
  doc,
  id,
  focus,
}: PlaceReviewEditInput): ReviewPlacement => {
  const range = mapBlockRange(edit.block, changes)
  if (range === null || doc.slice(range.from, range.to) !== edit.block.text)
    return { type: 'dropped', reason: 'text-changed' }
  if (state.items.some((item) => overlaps(item, range)))
    return { type: 'dropped', reason: 'occupied' }
  return {
    type: 'placed',
    draft: {
      id,
      ...range,
      source: 'block',
      original: edit.block.text,
      instruction: reviewInstruction(focus),
      origin: 'review',
    },
    result: {
      replacement: edit.replacement,
      rationale: edit.rationale,
      unchanged: false,
    },
  }
}

const readyReviewSuggestions = (
  state: SuggestionsState,
): readonly ReadySuggestion[] =>
  state.items.filter(
    (item): item is ReadySuggestion =>
      item.status === 'ready' &&
      item.origin === 'review' &&
      item.refine.status !== 'working',
  )

export const openReviewCount = (state: SuggestionsState): number =>
  readyReviewSuggestions(state).length

export type AcceptAllPlan = {
  readonly ids: readonly SuggestionId[]
  readonly changes: readonly {
    readonly from: number
    readonly to: number
    readonly insert: string
  }[]
}

export const acceptAllPlan = (state: SuggestionsState): AcceptAllPlan => {
  const ordered = [...readyReviewSuggestions(state)].sort(
    (a, b) => a.from - b.from,
  )
  return {
    ids: ordered.map((item) => item.id),
    changes: ordered.map(({ from, to, replacement }) => ({
      from,
      to,
      insert: replacement,
    })),
  }
}

const pluralize = (count: number): string =>
  count === 0
    ? 'no suggestions'
    : count === 1
      ? '1 suggestion'
      : `${count} suggestions`

export const reviewSummary = ({
  added,
  stopped,
}: {
  readonly added: number
  readonly stopped: boolean
}): string => `Review${stopped ? ' stopped' : ''}: ${pluralize(added)}`

export const reviewTaskLabel = (focus: string): string =>
  focus.trim() === ''
    ? 'review document → default criteria'
    : `review document → focus: ${focus.trim()}`

export const reviewNoticeText = ({
  added,
  error,
}: {
  readonly added: number
  readonly error?: ClientError
}): string =>
  error === undefined
    ? reviewSummary({ added, stopped: false })
    : added === 0
      ? describeError(error)
      : `${reviewSummary({ added, stopped: false })}. ${describeError(error)}`
