import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { bubbleVisible, dismissBubbleEffect, openAskEffect } from './ask-bubble'
import { currentTarget } from './current-target'
import {
  closeRefineEffect,
  openRefineEffect,
  refineInputOpenFor,
} from './refine-input'
import {
  acceptAtCursor,
  type EditorHandle,
  rejectAtCursor,
} from './suggestion-commands'
import {
  activeAtCursor,
  cancelRefineEffect,
  suggestionAtCursor,
} from './suggestion-field'

const openAsk = (handle: EditorHandle): boolean => {
  if (currentTarget(handle.state) === undefined) return false
  handle.dispatch({ effects: openAskEffect.of(null) })
  return true
}

export const openAskOrRefine = (handle: EditorHandle): boolean => {
  const active = activeAtCursor(handle.state)
  if (active === undefined || !handle.state.selection.main.empty)
    return openAsk(handle)
  if (active.refine.status === 'working') return false
  handle.dispatch({ effects: openRefineEffect.of(active.id) })
  return true
}

const closeRefineInput = (handle: EditorHandle): boolean => {
  if (refineInputOpenFor(handle.state) === null) return false
  handle.dispatch({ effects: closeRefineEffect.of(null) })
  return true
}

const cancelRefineAtCursor = (handle: EditorHandle): boolean => {
  const found = suggestionAtCursor(handle.state)
  if (found?.status !== 'ready' || found.refine.status === 'idle') return false
  handle.dispatch({ effects: cancelRefineEffect.of(found.id) })
  return true
}

const dismissBubble = (handle: EditorHandle): boolean => {
  if (!bubbleVisible(handle.state)) return false
  handle.dispatch({ effects: dismissBubbleEffect.of(null) })
  return true
}

export const escapeAtCursor = (handle: EditorHandle): boolean =>
  dismissBubble(handle) ||
  closeRefineInput(handle) ||
  cancelRefineAtCursor(handle) ||
  rejectAtCursor(handle)

export const suggestionKeymap = Prec.highest(
  keymap.of([
    { key: 'Mod-k', run: openAskOrRefine, preventDefault: true },
    { key: 'Mod-Enter', run: acceptAtCursor },
    { key: 'Escape', run: escapeAtCursor },
  ]),
)
