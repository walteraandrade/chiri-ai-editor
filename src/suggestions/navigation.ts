import { suggestionAt } from './state'
import type { Suggestion, SuggestionsState } from './types'

const inDocumentOrder = (items: readonly Suggestion[]): readonly Suggestion[] =>
  items.toSorted((left, right) => left.from - right.from || left.to - right.to)

const anchorOf = (state: SuggestionsState, target: Suggestion): number =>
  suggestionAt(state, target.from)?.id === target.id
    ? target.from
    : Math.min(target.from + 1, target.to)

export const stepSuggestion = (
  state: SuggestionsState,
  cursor: number,
  direction: 1 | -1,
): number | undefined => {
  const ordered = inDocumentOrder(state.items)
  const current = suggestionAt(state, cursor)
  const target =
    direction === 1
      ? (ordered.find(
          (item) =>
            item.id !== current?.id &&
            (current ? item.from >= current.to : item.from > cursor),
        ) ?? ordered.find((item) => item.id !== current?.id))
      : (ordered.findLast(
          (item) =>
            item.id !== current?.id &&
            (current ? item.to <= current.from : item.to < cursor),
        ) ?? ordered.findLast((item) => item.id !== current?.id))
  return target === undefined ? undefined : anchorOf(state, target)
}
