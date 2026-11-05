import type { SuggestionId } from '../suggestions/types'

export type RefineDraft = {
  readonly owner: SuggestionId
  readonly value: string
  readonly focused: boolean
}

export const restorableDraft = (
  draft: RefineDraft | undefined,
  owner: SuggestionId | null,
): RefineDraft | null =>
  draft !== undefined && owner !== null && draft.owner === owner ? draft : null
