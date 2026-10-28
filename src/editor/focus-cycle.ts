export const cycleIndex = (
  count: number,
  current: number,
  backward: boolean,
): number => {
  if (count === 0) return -1
  if (current < 0) return backward ? count - 1 : 0
  return (current + (backward ? count - 1 : 1)) % count
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])'

const focusableIn = (container: HTMLElement): readonly HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(FOCUSABLE),
]

export const focusEdge = (
  container: HTMLElement,
  backward: boolean,
): boolean => {
  const items = focusableIn(container)
  const target = items[cycleIndex(items.length, -1, backward)]
  if (target === undefined) return false
  target.focus()
  return true
}

export const cycleTab = (
  container: HTMLElement,
  event: KeyboardEvent,
): void => {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey)
    return
  const items = focusableIn(container)
  const active = container.ownerDocument.activeElement
  const current = active instanceof HTMLElement ? items.indexOf(active) : -1
  const next = items[cycleIndex(items.length, current, event.shiftKey)]
  if (next === undefined) return
  event.preventDefault()
  next.focus()
}
