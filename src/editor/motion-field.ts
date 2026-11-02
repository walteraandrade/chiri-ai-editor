import {
  type ChangeDesc,
  type EditorState,
  StateEffect,
  StateField,
  type Transaction,
} from '@codemirror/state'
import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { newlyRevealedIds } from '../suggestions/moments'
import { findSuggestion } from '../suggestions/state'
import type { SuggestionId, SuggestionsState } from '../suggestions/types'
import {
  acceptEffect,
  acceptManyEffect,
  rejectEffect,
  rejectReviewEffect,
  suggestionsOf,
} from './suggestion-field'

export type RangeMomentKind = 'land' | 'settle'

type MomentDraft =
  | { readonly kind: 'reveal'; readonly id: SuggestionId }
  | {
      readonly kind: RangeMomentKind
      readonly from: number
      readonly to: number
    }

export type Moment = MomentDraft & { readonly serial: number }

type MotionState = {
  readonly moments: readonly Moment[]
  readonly nextSerial: number
}

const MOMENT_DURATION_MS: Readonly<Record<Moment['kind'], number>> = {
  reveal: 1100,
  land: 1500,
  settle: 500,
}

export const expireMomentEffect = StateEffect.define<number>()

const effectValues = <T>(
  transaction: Transaction,
  pick: (effect: StateEffect<unknown>) => readonly T[],
): readonly T[] => transaction.effects.flatMap(pick)

const acceptedIds = (transaction: Transaction): readonly SuggestionId[] =>
  effectValues(transaction, (effect) =>
    effect.is(acceptEffect)
      ? [effect.value]
      : effect.is(acceptManyEffect)
        ? [...effect.value]
        : [],
  )

const rejectedIds = (
  transaction: Transaction,
  before: SuggestionsState,
  after: SuggestionsState,
): readonly SuggestionId[] =>
  effectValues(transaction, (effect) =>
    effect.is(rejectEffect)
      ? [effect.value]
      : effect.is(rejectReviewEffect)
        ? before.items
            .filter(
              (item) =>
                item.origin === 'review' &&
                findSuggestion(after, item.id) === undefined,
            )
            .map((item) => item.id)
        : [],
  )

const rangeMoments = (
  kind: RangeMomentKind,
  ids: readonly SuggestionId[],
  before: SuggestionsState,
  changes: ChangeDesc,
): readonly MomentDraft[] =>
  ids.flatMap((id) => {
    const found = findSuggestion(before, id)
    if (found === undefined) return []
    const from = changes.mapPos(found.from, -1)
    const to = changes.mapPos(found.to, 1)
    return from < to ? [{ kind, from, to }] : []
  })

const newMoments = (transaction: Transaction): readonly MomentDraft[] => {
  const before = suggestionsOf(transaction.startState)
  const after = suggestionsOf(transaction.state)
  if (before === after) return []
  return [
    ...newlyRevealedIds(before, after).map((id) => ({
      kind: 'reveal' as const,
      id,
    })),
    ...rangeMoments(
      'land',
      acceptedIds(transaction),
      before,
      transaction.changes,
    ),
    ...rangeMoments(
      'settle',
      rejectedIds(transaction, before, after),
      before,
      transaction.changes,
    ),
  ]
}

const carryOver =
  (transaction: Transaction, expired: ReadonlySet<number>) =>
  (moment: Moment): readonly Moment[] => {
    if (expired.has(moment.serial)) return []
    if (moment.kind === 'reveal')
      return findSuggestion(suggestionsOf(transaction.state), moment.id)
        ? [moment]
        : []
    return transaction.docChanged ? [] : [moment]
  }

export const motionField = StateField.define<MotionState>({
  create: () => ({ moments: [], nextSerial: 0 }),
  update: (value, transaction) => {
    const expired = new Set(
      effectValues(transaction, (effect) =>
        effect.is(expireMomentEffect) ? [effect.value] : [],
      ),
    )
    const kept = value.moments.flatMap(carryOver(transaction, expired))
    const added = newMoments(transaction).map(
      (draft, index): Moment => ({
        ...draft,
        serial: value.nextSerial + index,
      }),
    )
    const unchanged =
      added.length === 0 &&
      kept.length === value.moments.length &&
      kept.every((moment, index) => moment === value.moments[index])
    return unchanged
      ? value
      : {
          moments: [...kept, ...added],
          nextSerial: value.nextSerial + added.length,
        }
  },
})

export const momentsOf = (state: EditorState): readonly Moment[] =>
  state.field(motionField, false)?.moments ?? []

export const revealingIds = (state: EditorState): ReadonlySet<SuggestionId> =>
  new Set(
    momentsOf(state).flatMap((moment) =>
      moment.kind === 'reveal' ? [moment.id] : [],
    ),
  )

export const createExpiryScheduler = (expire: (serial: number) => void) => {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  return {
    schedule: (moments: readonly Moment[]): void => {
      for (const moment of moments) {
        if (timers.has(moment.serial)) continue
        timers.set(
          moment.serial,
          setTimeout(() => {
            timers.delete(moment.serial)
            expire(moment.serial)
          }, MOMENT_DURATION_MS[moment.kind]),
        )
      }
    },
    destroy: (): void => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    },
  }
}

const scheduleExpiry = (view: EditorView) => {
  const scheduler = createExpiryScheduler((serial) =>
    view.dispatch({ effects: expireMomentEffect.of(serial) }),
  )
  return {
    update: (update: ViewUpdate) => {
      if (
        update.state.field(motionField) !== update.startState.field(motionField)
      )
        scheduler.schedule(momentsOf(update.state))
    },
    destroy: scheduler.destroy,
  }
}

export const motion = [motionField, ViewPlugin.define(scheduleExpiry)]
