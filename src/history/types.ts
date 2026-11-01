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
  | { readonly kind: 'external' }

export type Version = {
  readonly id: VersionId
  readonly at: number
  readonly cause: VersionCause
  readonly text: string
  readonly saved?: string
  readonly wordsAdded?: number
  readonly wordsRemoved?: number
}

export type History = readonly Version[]

export type VersionSummary = {
  readonly id: VersionId
  readonly at: number
  readonly cause: VersionCause
  readonly words: number
  readonly wordsAdded: number
  readonly wordsRemoved: number
  readonly saved?: string
}

export type VersionList = readonly VersionSummary[]
