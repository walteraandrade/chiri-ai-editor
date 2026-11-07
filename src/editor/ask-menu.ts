import type { QuickAction } from '../ai/quick-actions'

export type AskRow =
  | {
      readonly kind: 'action'
      readonly action: QuickAction
      readonly match: { readonly from: number; readonly to: number } | null
    }
  | { readonly kind: 'free'; readonly text: string }

const browseRow = (action: QuickAction): AskRow => ({
  kind: 'action',
  action,
  match: null,
})

const matchRows = (
  actions: readonly QuickAction[],
  query: string,
): readonly AskRow[] => {
  const needle = query.toLowerCase()
  const found = actions
    .map((action) => ({
      action,
      at: action.label.toLowerCase().indexOf(needle),
    }))
    .filter(({ at }) => at >= 0)
  return [
    ...found.filter(({ at }) => at === 0),
    ...found.filter(({ at }) => at > 0),
  ].map(({ action, at }) => ({
    kind: 'action',
    action,
    match: { from: at, to: at + needle.length },
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

export const askHint = (
  actions: readonly QuickAction[],
): string | undefined => {
  const first = actions[0]
  return first === undefined
    ? undefined
    : `Try “${first.label.toLowerCase()}”, or press ↓ for all actions`
}
