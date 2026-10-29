import type { ClientError } from '../ai/errors'
import type { QuickActionId } from '../ai/quick-actions'
import type { AdaptiveDiff } from '../diff/adaptive-diff'

export type SuggestionId = string

export type TargetSource = 'selection' | 'block'

export type SuggestionOrigin = 'ask' | 'review'

export type Instruction =
  | {
      readonly type: 'quick-action'
      readonly id: QuickActionId
      readonly label: string
      readonly text: string
    }
  | { readonly type: 'free-text'; readonly text: string }

export type SuggestionBase = {
  readonly id: SuggestionId
  readonly from: number
  readonly to: number
  readonly source: TargetSource
  readonly original: string
  readonly instruction: Instruction
  readonly sequence: number
  readonly origin: SuggestionOrigin
}

export type PendingSuggestion = SuggestionBase & {
  readonly status: 'pending'
}

export type RefineStep = {
  readonly instruction: Instruction
  readonly replacement: string
  readonly rationale: string
}

export type RefineState =
  | { readonly status: 'idle' }
  | { readonly status: 'working'; readonly instruction: Instruction }
  | {
      readonly status: 'failed'
      readonly instruction: Instruction
      readonly error: ClientError
    }

export type ReadySuggestion = SuggestionBase & {
  readonly status: 'ready'
  readonly replacement: string
  readonly rationale: string
  readonly diff: AdaptiveDiff
  readonly history: readonly RefineStep[]
  readonly shown: number
  readonly refine: RefineState
}

export type FailedSuggestion = SuggestionBase & {
  readonly status: 'error'
  readonly error: ClientError
}

export type Suggestion = PendingSuggestion | ReadySuggestion | FailedSuggestion

export type NoticeKind = 'text-changed' | 'replaced' | 'no-change'

export type SuggestionNotice = {
  readonly serial: number
  readonly kind: NoticeKind
}

export type SuggestionsState = {
  readonly items: readonly Suggestion[]
  readonly nextSequence: number
  readonly notice: SuggestionNotice | null
}

export type SuggestionDraft = {
  readonly id: SuggestionId
  readonly from: number
  readonly to: number
  readonly source: TargetSource
  readonly original: string
  readonly instruction: Instruction
  readonly origin?: SuggestionOrigin
}
