import type { QuickAction } from '../ai/quick-actions'

export type AskRow =
  | {
      readonly kind: 'action'
      readonly action: QuickAction
      readonly match: { readonly from: number; readonly to: number } | null
    }
  | { readonly kind: 'free'; readonly text: string }

export type AskMenu = {
  readonly query: string
  readonly browsing: boolean
  readonly active: number
}

export const EMPTY_ASK_MENU: AskMenu = { query: '', browsing: false, active: 0 }

const browseRow = (action: QuickAction): AskRow => ({
  kind: 'action',
  action,
  match: null,
})

const wordStart = (label: string, needle: string): number => {
  const lower = label.toLowerCase()
  if (lower.startsWith(needle)) return 0
  const found = lower.indexOf(` ${needle}`)
  return found < 0 ? -1 : found + 1
}

const matchRows = (
  actions: readonly QuickAction[],
  query: string,
): readonly AskRow[] => {
  const needle = query.toLowerCase()
  const matched = actions
    .map((action) => ({ action, from: wordStart(action.label, needle) }))
    .filter(({ from }) => from >= 0)
  return [
    ...matched.filter(({ from }) => from === 0),
    ...matched.filter(({ from }) => from > 0),
  ].map(({ action, from }) => ({
    kind: 'action',
    action,
    match: { from, to: from + needle.length },
  }))
}

export const askRows = (
  actions: readonly QuickAction[],
  query: string,
  browsing: boolean,
): readonly AskRow[] => {
  const text = query.trim()
  if (text === '') return browsing ? actions.map(browseRow) : []
  return [...matchRows(actions, text), { kind: 'free', text }]
}

export const menuRows = (
  actions: readonly QuickAction[],
  menu: AskMenu,
): readonly AskRow[] => askRows(actions, menu.query, menu.browsing)

export const typeAskMenu = (query: string): AskMenu => ({
  query,
  browsing: false,
  active: 0,
})

export const moveAskMenu = (
  actions: readonly QuickAction[],
  menu: AskMenu,
  step: 1 | -1,
): AskMenu => {
  if (menu.query === '' && !menu.browsing)
    return { ...menu, browsing: true, active: 0 }
  const count = menuRows(actions, menu).length
  return count === 0
    ? menu
    : { ...menu, active: (menu.active + step + count) % count }
}

export const hoverAskMenu = (menu: AskMenu, active: number): AskMenu =>
  menu.active === active ? menu : { ...menu, active }

export const chosenRow = (
  actions: readonly QuickAction[],
  menu: AskMenu,
): AskRow | undefined => menuRows(actions, menu)[menu.active]

export const hintVisible = (menu: AskMenu): boolean =>
  menu.query === '' && !menu.browsing

export const askHint = (
  actions: readonly QuickAction[],
): string | undefined => {
  const first = actions[0]
  return first === undefined
    ? undefined
    : `Try “${first.label.toLowerCase()}”, or press ↓ for all actions`
}
