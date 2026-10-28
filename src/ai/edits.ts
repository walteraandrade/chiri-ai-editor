import type { Block } from '../blocks/extract-blocks'
import type { ReviewEdit, SuggestionOutput } from './schemas'

export const MAX_REVIEW_EDITS = 6
export const JUNK_MIN_ORIGINAL_WORDS = 15
export const JUNK_MAX_REPLACEMENT_WORDS = 3

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

const wordCount = (text: string): number => text.match(WORD)?.length ?? 0

export const isJunkReplacement = (
  original: string,
  replacement: string,
): boolean =>
  wordCount(original) > JUNK_MIN_ORIGINAL_WORDS &&
  wordCount(replacement) < JUNK_MAX_REPLACEMENT_WORDS

export type DropReason =
  | 'unknown-block'
  | 'code-block'
  | 'occupied'
  | 'duplicate-block'
  | 'empty'
  | 'unchanged'
  | 'junk'
  | 'over-limit'

export type ValidatedEdit = ReviewEdit & { readonly block: Block }

export type DroppedEdit = {
  readonly edit: ReviewEdit
  readonly reason: DropReason
}

export type ReviewValidationState = {
  readonly validated: number
  readonly seen: ReadonlySet<string>
}

export type ReviewValidationContext = {
  readonly blocks: readonly Block[]
  readonly occupied: ReadonlySet<string>
}

export type ReviewOutcome =
  | { readonly type: 'validated'; readonly edit: ValidatedEdit }
  | ({ readonly type: 'dropped' } & DroppedEdit)

export const initialReviewState: ReviewValidationState = {
  validated: 0,
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
  if (block.kind !== 'heading' && isJunkReplacement(block.text, replacement))
    return 'junk'
  if (state.validated >= MAX_REVIEW_EDITS) return 'over-limit'
  return undefined
}

export const validateReviewEdit = (
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
      validated: state.validated + 1,
      seen: new Set([...state.seen, block.id]),
    },
    outcome: { type: 'validated', edit: { ...edit, block } },
  }
}

type ValidationRun = {
  readonly state: ReviewValidationState
  readonly validated: readonly ValidatedEdit[]
  readonly dropped: readonly DroppedEdit[]
}

export const validateReviewEdits = (
  edits: readonly ReviewEdit[],
  blocks: readonly Block[],
  occupied: ReadonlySet<string> = new Set(),
): {
  readonly validated: readonly ValidatedEdit[]
  readonly dropped: readonly DroppedEdit[]
} => {
  const context = { blocks, occupied }
  const { validated, dropped } = edits.reduce<ValidationRun>(
    (run, edit) => {
      const { state, outcome } = validateReviewEdit(context, run.state, edit)
      return outcome.type === 'validated'
        ? {
            state,
            validated: run.validated.concat(outcome.edit),
            dropped: run.dropped,
          }
        : {
            state,
            validated: run.validated,
            dropped: run.dropped.concat({
              edit: outcome.edit,
              reason: outcome.reason,
            }),
          }
    },
    { state: initialReviewState, validated: [], dropped: [] },
  )
  return { validated, dropped }
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
