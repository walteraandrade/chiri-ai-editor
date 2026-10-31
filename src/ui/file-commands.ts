export type FileCommand = 'open' | 'save' | 'save-as'

type KeyLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>

export const fileCommandOf = (
  event: KeyLike,
  apple: boolean,
): FileCommand | null => {
  const modifier = apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  if (!modifier || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 's') return event.shiftKey ? 'save-as' : 'save'
  if (key === 'o' && !event.shiftKey) return 'open'
  return null
}
