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

export const railAnswer = (open: boolean): LibraryKeyAnswer =>
  open ? 'fold-and-return' : 'open-and-focus'

export const ECHO_WINDOW_MS = 150

export const isEchoOfKey = (lastKeyAt: number | null, now: number): boolean =>
  lastKeyAt !== null && now - lastKeyAt < ECHO_WINDOW_MS

export const isModalOpen = (doc: Pick<Document, 'querySelector'>): boolean =>
  doc.querySelector('dialog[open]') !== null

const isModShortcut = (
  event: KeyboardEvent,
  apple: boolean,
  key: string,
): boolean =>
  event.key.toLowerCase() === key &&
  (apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
  !event.altKey &&
  !event.shiftKey

export const isLibraryShortcut = (
  event: KeyboardEvent,
  apple: boolean,
): boolean => isModShortcut(event, apple, 'b')

export const isSearchShortcut = (
  event: KeyboardEvent,
  apple: boolean,
): boolean => isModShortcut(event, apple, 'p')
