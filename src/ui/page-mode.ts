import {
  type HistoryMode,
  type HistoryModeAction,
  nextHistoryMode,
  visibleMode,
} from '../history/view-mode'

type Listed = Parameters<typeof visibleMode>[1]

export type PageMode = HistoryMode | { readonly kind: 'evals' }

export type PageAction =
  | HistoryModeAction
  | { readonly type: 'toggle-evals' }
  | { readonly type: 'open-evals' }

const EDITING: PageMode = { kind: 'editing' }
const EVALS: PageMode = { kind: 'evals' }

export const nextPageMode =
  (history: Listed) =>
  (mode: PageMode, action: PageAction): PageMode => {
    if (action.type === 'toggle-evals')
      return mode.kind === 'evals' ? EDITING : EVALS
    if (action.type === 'open-evals') return EVALS
    if (mode.kind === 'evals')
      return action.type === 'step'
        ? mode
        : nextHistoryMode(history)(EDITING, action)
    return nextHistoryMode(history)(mode, action)
  }

export const visiblePage = (
  mode: PageMode,
  history: Listed,
  evalsAvailable: boolean,
): PageMode =>
  mode.kind === 'evals'
    ? evalsAvailable
      ? mode
      : EDITING
    : visibleMode(mode, history)
