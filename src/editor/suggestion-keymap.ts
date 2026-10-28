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
import { activeAtCursor } from './suggestion-field'

const openAsk = (handle: EditorHandle): boolean => {
  if (currentTarget(handle.state) === undefined) return false
  handle.dispatch({ effects: openAskEffect.of(null) })
  return true
}

const openRefine = (handle: EditorHandle): boolean => {
  const active = activeAtCursor(handle.state)
  if (active === undefined || !handle.state.selection.main.empty) return false
  handle.dispatch({ effects: openRefineEffect.of(active.id) })
  return true
}

export const openAskOrRefine = (handle: EditorHandle): boolean =>
  openRefine(handle) || openAsk(handle)

const closeRefineInput = (handle: EditorHandle): boolean => {
  if (refineInputOpenFor(handle.state) === null) return false
  handle.dispatch({ effects: closeRefineEffect.of(null) })
  return true
}

const dismissBubble = (handle: EditorHandle): boolean => {
  if (!bubbleVisible(handle.state)) return false
  handle.dispatch({ effects: dismissBubbleEffect.of(null) })
  return true
}

export const escapeAtCursor = (handle: EditorHandle): boolean =>
  dismissBubble(handle) || closeRefineInput(handle) || rejectAtCursor(handle)

export const suggestionKeymap = Prec.highest(
  keymap.of([
    { key: 'Mod-k', run: openAskOrRefine, preventDefault: true },
    { key: 'Mod-Enter', run: acceptAtCursor },
    { key: 'Escape', run: escapeAtCursor },
  ]),
)
