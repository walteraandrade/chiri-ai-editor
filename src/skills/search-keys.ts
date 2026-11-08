export type SearchKeyEvent = {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
}

export type SearchKeyState = {
  readonly count: number
  readonly active: number
  readonly text: string
}

export type SearchKeyAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'move'; readonly to: number }
  | { readonly kind: 'open'; readonly index: number }
  | { readonly kind: 'clear' }
  | { readonly kind: 'leave' }

const NONE: SearchKeyAction = { kind: 'none' }

export const searchKey = (
  event: SearchKeyEvent,
  { count, active, text }: SearchKeyState,
): SearchKeyAction => {
  if (event.ctrlKey || event.metaKey || event.altKey) return NONE
  switch (event.key) {
    case 'ArrowDown':
      return count === 0 ? NONE : { kind: 'move', to: (active + 1) % count }
    case 'ArrowUp':
      return count === 0
        ? NONE
        : { kind: 'move', to: (active - 1 + count) % count }
    case 'Enter':
      return count === 0 ? NONE : { kind: 'open', index: active }
    case 'Escape':
      return text === '' ? { kind: 'leave' } : { kind: 'clear' }
    default:
      return NONE
  }
}
