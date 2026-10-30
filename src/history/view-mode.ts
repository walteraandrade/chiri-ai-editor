import type { History, VersionId } from './types'

export type HistoryMode =
  | { readonly kind: 'editing' }
  | { readonly kind: 'version'; readonly id: VersionId }
  | { readonly kind: 'full' }

export type HistoryModeAction =
  | { readonly type: 'show'; readonly id: VersionId }
  | { readonly type: 'step'; readonly delta: number }
  | { readonly type: 'toggle-full' }
  | { readonly type: 'close' }

const EDITING: HistoryMode = { kind: 'editing' }

const indexOf = (history: History, id: VersionId): number =>
  history.findIndex((version) => version.id === id)

export const nextHistoryMode =
  (history: History) =>
  (mode: HistoryMode, action: HistoryModeAction): HistoryMode => {
    switch (action.type) {
      case 'show':
        return mode.kind === 'version' && mode.id === action.id
          ? EDITING
          : { kind: 'version', id: action.id }
      case 'step': {
        if (mode.kind !== 'version') return mode
        const index = indexOf(history, mode.id)
        if (index < 0) return EDITING
        const target =
          history[
            Math.min(history.length - 1, Math.max(0, index + action.delta))
          ]
        return target ? { kind: 'version', id: target.id } : EDITING
      }
      case 'toggle-full':
        return mode.kind === 'full' ? EDITING : { kind: 'full' }
      case 'close':
        return EDITING
    }
  }

export const visibleMode = (
  mode: HistoryMode,
  history: History,
): HistoryMode =>
  mode.kind === 'version' && indexOf(history, mode.id) < 0 ? EDITING : mode

const KEY_TARGETS: Record<string, (index: number, last: number) => number> = {
  ArrowLeft: (index) => Math.max(0, index - 1),
  ArrowRight: (index, last) => Math.min(last, index + 1),
  Home: () => 0,
  End: (_, last) => last,
}

export const dotTarget = (
  history: History,
  current: VersionId | null,
  key: string,
): VersionId | null => {
  const move = KEY_TARGETS[key]
  if (move === undefined || history.length === 0) return null
  const last = history.length - 1
  const index = current === null ? last : indexOf(history, current)
  return history[move(index < 0 ? last : index, last)]?.id ?? null
}
