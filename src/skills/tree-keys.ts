import type { TreeItem } from './library-tree'

export type TreeKeyEvent = {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
}

export type TreeAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'focus'; readonly id: string }
  | { readonly kind: 'toggle'; readonly id: string; readonly expand: boolean }
  | {
      readonly kind: 'open'
      readonly id: string
      readonly focusText: boolean
    }
  | { readonly kind: 'remove'; readonly id: string }

export type TreeKeyResult = {
  readonly action: TreeAction
  readonly typed: string
  readonly handled: boolean
}

const NONE: TreeAction = { kind: 'none' }

const focus = (id: string | undefined): TreeAction =>
  id === undefined ? NONE : { kind: 'focus', id }

const activate = (item: TreeItem, focusText: boolean): TreeAction =>
  item.node.kind === 'file'
    ? item.node.openable === true
      ? { kind: 'open', id: item.node.id, focusText }
      : NONE
    : item.expandable
      ? { kind: 'toggle', id: item.node.id, expand: !item.expanded }
      : NONE

const matchesFrom = (
  items: readonly TreeItem[],
  from: number,
  prefix: string,
): TreeItem | undefined => {
  const ordered = [...items.slice(from), ...items.slice(0, from)]
  return ordered.find(({ node }) => node.name.toLowerCase().startsWith(prefix))
}

const typeAhead = (
  items: readonly TreeItem[],
  at: number,
  character: string,
  typed: string,
): TreeKeyResult => {
  const buffer = `${typed}${character}`.toLowerCase()
  const cycling = [...buffer].every((letter) => letter === buffer[0])
  const prefix = cycling ? (buffer[0] ?? '') : buffer
  const from = cycling ? at + 1 : Math.max(at, 0)
  const found = matchesFrom(items, from, prefix)
  return { action: focus(found?.node.id), typed: buffer, handled: true }
}

const isCharacter = (key: string): boolean => [...key].length === 1

const navigate = (
  items: readonly TreeItem[],
  at: number,
  key: string,
): TreeAction | undefined => {
  const current = items[at]
  switch (key) {
    case 'ArrowDown':
      return focus(items[at + 1]?.node.id)
    case 'ArrowUp':
      return at === -1
        ? focus(items[0]?.node.id)
        : focus(items[at - 1]?.node.id)
    case 'Home':
      return focus(items[0]?.node.id)
    case 'End':
      return focus(items.at(-1)?.node.id)
    case 'ArrowRight':
      if (current === undefined || !current.expandable) return NONE
      return current.expanded
        ? focus(items[at + 1]?.node.id)
        : { kind: 'toggle', id: current.node.id, expand: true }
    case 'ArrowLeft':
      if (current === undefined) return NONE
      return current.expanded
        ? { kind: 'toggle', id: current.node.id, expand: false }
        : focus(current.parentId ?? undefined)
    case 'Enter':
      return current === undefined ? NONE : activate(current, true)
    case 'Delete':
      return current?.node.kind === 'root' && current.node.removable === true
        ? { kind: 'remove', id: current.node.id }
        : NONE
    default:
      return undefined
  }
}

export const treeKey = (
  items: readonly TreeItem[],
  focusedId: string | null,
  event: TreeKeyEvent,
  typed: string,
): TreeKeyResult => {
  if (event.ctrlKey || event.metaKey || event.altKey || items.length === 0)
    return { action: NONE, typed: '', handled: false }
  const at = items.findIndex(({ node }) => node.id === focusedId)
  const current = items[at]
  if (event.key === ' ' && typed === '')
    return {
      action: current === undefined ? NONE : activate(current, false),
      typed: '',
      handled: true,
    }
  const navigation = navigate(items, at, event.key)
  if (navigation !== undefined)
    return { action: navigation, typed: '', handled: true }
  return isCharacter(event.key)
    ? typeAhead(items, at, event.key, typed)
    : { action: NONE, typed: '', handled: false }
}
