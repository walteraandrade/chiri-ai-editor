export type HistoryCommand = 'undo' | 'redo'

type KeyLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>

export const historyCommandOf = (
  event: KeyLike,
  apple: boolean,
): HistoryCommand | null => {
  const modifier = apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  if (!modifier || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !apple && !event.shiftKey) return 'redo'
  return null
}
