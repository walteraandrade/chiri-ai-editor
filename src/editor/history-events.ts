import type { Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { HistoryEvent } from '../history/events'
import type { AcceptedChange } from '../history/types'
import { instructionLabel } from '../suggestions/instruction'
import type { SuggestionId } from '../suggestions/types'
import {
  acceptEffect,
  acceptManyEffect,
  suggestionsOf,
} from './suggestion-field'

const acceptedIds = (transaction: Transaction): readonly SuggestionId[] =>
  transaction.effects.flatMap((effect) =>
    effect.is(acceptEffect)
      ? [effect.value]
      : effect.is(acceptManyEffect)
        ? effect.value
        : [],
  )

const acceptedChanges = (
  transaction: Transaction,
): readonly AcceptedChange[] => {
  const { items } = suggestionsOf(transaction.startState)
  return acceptedIds(transaction).flatMap((id) => {
    const found = items.find((item) => item.id === id)
    return found?.status === 'ready'
      ? [
          {
            origin: found.origin,
            instruction: instructionLabel(found.instruction),
            rationale: found.rationale,
          },
        ]
      : []
  })
}

export const historyEventOf = (
  transaction: Transaction,
): HistoryEvent | null => {
  if (!transaction.docChanged) return null
  if (
    transaction.isUserEvent('input.open') ||
    transaction.isUserEvent('input.restore')
  )
    return { type: 'replaced', before: transaction.startState.doc.toString() }
  const text = transaction.newDoc.toString()
  return transaction.isUserEvent('input.accept')
    ? {
        type: 'accepted',
        before: transaction.startState.doc.toString(),
        text,
        changes: acceptedChanges(transaction),
      }
    : { type: 'edited', text }
}

export const historyEvents = (onEvent: (event: HistoryEvent) => void) =>
  EditorView.updateListener.of((update) => {
    for (const transaction of update.transactions) {
      const event = historyEventOf(transaction)
      if (event) onEvent(event)
    }
  })
