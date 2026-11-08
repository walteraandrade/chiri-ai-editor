export type LibraryFocus = {
  readonly open: boolean
  readonly focused: boolean
}

export type LibraryKeyAnswer = 'open-and-focus' | 'focus' | 'fold-and-return'

export const libraryKeyAnswer = ({
  open,
  focused,
}: LibraryFocus): LibraryKeyAnswer =>
  !open ? 'open-and-focus' : focused ? 'fold-and-return' : 'focus'

export const isLibraryShortcut = (
  event: KeyboardEvent,
  apple: boolean,
): boolean =>
  event.key.toLowerCase() === 'b' &&
  (apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
  !event.altKey &&
  !event.shiftKey
