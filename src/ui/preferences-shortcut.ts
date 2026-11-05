export const isPreferencesShortcut = (event: KeyboardEvent): boolean =>
  event.key === ',' &&
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey
