import {
  type ChangeDesc,
  ChangeSet,
  type EditorState,
  StateEffect,
  StateField,
} from '@codemirror/state'
import { openReviewCount } from '../suggestions/review'
import { suggestionsOf } from './suggestion-field'

export type ReviewRun = {
  readonly focus: string
  readonly changes: ChangeDesc
  readonly added: number
  readonly dropped: number
}

export type ReviewStatus = {
  readonly running: boolean
  readonly added: number
  readonly open: number
}

export const idleReviewStatus: ReviewStatus = {
  running: false,
  added: 0,
  open: 0,
}

export const startReviewEffect = StateEffect.define<{
  readonly focus: string
}>()
export const reviewTallyEffect = StateEffect.define<'added' | 'dropped'>()
export const endReviewEffect = StateEffect.define<null>()

const applyRunEffect =
  (docLength: number) =>
  (run: ReviewRun | null, effect: StateEffect<unknown>): ReviewRun | null => {
    if (effect.is(startReviewEffect))
      return {
        focus: effect.value.focus,
        changes: ChangeSet.empty(docLength).desc,
        added: 0,
        dropped: 0,
      }
    if (effect.is(endReviewEffect)) return null
    if (run !== null && effect.is(reviewTallyEffect))
      return effect.value === 'added'
        ? { ...run, added: run.added + 1 }
        : { ...run, dropped: run.dropped + 1 }
    return run
  }

export const reviewRunField = StateField.define<ReviewRun | null>({
  create: () => null,
  update: (value, transaction) => {
    const tracked =
      value === null || !transaction.docChanged
        ? value
        : {
            ...value,
            changes: value.changes.composeDesc(transaction.changes.desc),
          }
    return transaction.effects.reduce(
      applyRunEffect(transaction.newDoc.length),
      tracked,
    )
  },
})

export const reviewRunOf = (state: EditorState): ReviewRun | null =>
  state.field(reviewRunField)

export const reviewStatusOf = (state: EditorState): ReviewStatus => {
  const run = reviewRunOf(state)
  return {
    running: run !== null,
    added: run?.added ?? 0,
    open: openReviewCount(suggestionsOf(state)),
  }
}

export const sameReviewStatus = (a: ReviewStatus, b: ReviewStatus): boolean =>
  a.running === b.running && a.added === b.added && a.open === b.open
