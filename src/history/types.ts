import type { SuggestionOrigin } from '../suggestions/types'

export type VersionId = number

export type AcceptedChange = {
  readonly origin: SuggestionOrigin
  readonly instruction: string
  readonly rationale: string
}

export type VersionCause =
  | { readonly kind: 'started' }
  | { readonly kind: 'edited' }
  | { readonly kind: 'accepted'; readonly changes: readonly AcceptedChange[] }
  | { readonly kind: 'opened'; readonly name: string }
  | { readonly kind: 'restored'; readonly from: VersionId }

export type Version = {
  readonly id: VersionId
  readonly at: number
  readonly cause: VersionCause
  readonly text: string
  readonly saved?: string
}

export type History = readonly Version[]
