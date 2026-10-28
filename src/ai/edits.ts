import type { Block } from '../blocks/extract-blocks'
import type { ReviewEdit, SuggestionOutput } from './schemas'

export const MAX_REVIEW_EDITS = 6

export type DropReason =
  | 'unknown-block'
  | 'code-block'
  | 'occupied'
  | 'duplicate-block'
  | 'empty'
  | 'unchanged'
  | 'over-limit'

export type AcceptedEdit = ReviewEdit & { readonly block: Block }

export type DroppedEdit = {
  readonly edit: ReviewEdit
  readonly reason: DropReason
}

export type ReviewValidationState = {
  readonly accepted: number
  readonly seen: ReadonlySet<string>
}

export type ReviewValidationContext = {
  readonly blocks: readonly Block[]
  readonly occupied: ReadonlySet<string>
}

export type ReviewOutcome =
  | { readonly type: 'accepted'; readonly edit: AcceptedEdit }
  | ({ readonly type: 'dropped' } & DroppedEdit)

export const initialReviewState: ReviewValidationState = {
  accepted: 0,
  seen: new Set(),
}

const dropReason = (
  occupied: ReadonlySet<string>,
  state: ReviewValidationState,
  edit: ReviewEdit,
  block: Block | undefined,
): DropReason | undefined => {
  if (block === undefined) return 'unknown-block'
  if (block.kind === 'code') return 'code-block'
  if (occupied.has(block.id)) return 'occupied'
  if (state.seen.has(block.id)) return 'duplicate-block'
  const replacement = edit.replacement.trim()
  if (replacement === '') return 'empty'
  if (replacement === block.text.trim()) return 'unchanged'
  if (state.accepted >= MAX_REVIEW_EDITS) return 'over-limit'
  return undefined
}

export const acceptReviewEdit = (
  context: ReviewValidationContext,
  state: ReviewValidationState,
  edit: ReviewEdit,
): {
  readonly state: ReviewValidationState
  readonly outcome: ReviewOutcome
} => {
  const block = context.blocks.find(
    (candidate) => candidate.id === edit.blockId,
  )
  const reason = dropReason(context.occupied, state, edit, block)
  if (reason !== undefined || block === undefined) {
    return {
      state,
      outcome: { type: 'dropped', edit, reason: reason ?? 'unknown-block' },
    }
  }
  return {
    state: {
      accepted: state.accepted + 1,
      seen: new Set([...state.seen, block.id]),
    },
    outcome: { type: 'accepted', edit: { ...edit, block } },
  }
}

export const validateReviewEdits = (
  edits: readonly ReviewEdit[],
  blocks: readonly Block[],
  occupied: ReadonlySet<string> = new Set(),
): {
  readonly accepted: readonly AcceptedEdit[]
  readonly dropped: readonly DroppedEdit[]
} => {
  const context = { blocks, occupied }
  const accepted: AcceptedEdit[] = []
  const dropped: DroppedEdit[] = []
  let state = initialReviewState
  for (const edit of edits) {
    const step = acceptReviewEdit(context, state, edit)
    state = step.state
    if (step.outcome.type === 'accepted') accepted.push(step.outcome.edit)
    else dropped.push({ edit: step.outcome.edit, reason: step.outcome.reason })
  }
  return { accepted, dropped }
}

export type SuggestionResult = SuggestionOutput & {
  readonly unchanged: boolean
}

export type SuggestionCheck =
  | { readonly type: 'valid'; readonly suggestion: SuggestionResult }
  | { readonly type: 'invalid'; readonly reason: 'empty' }

export const checkSuggestion = (
  original: string,
  output: SuggestionOutput,
): SuggestionCheck => {
  const replacement = output.replacement.trim()
  return replacement === ''
    ? { type: 'invalid', reason: 'empty' }
    : {
        type: 'valid',
        suggestion: { ...output, unchanged: replacement === original.trim() },
      }
}
