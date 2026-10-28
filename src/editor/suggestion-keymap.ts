import { Prec } from '@codemirror/state'
import { type Command, keymap } from '@codemirror/view'
import { bubbleVisible, dismissBubbleEffect, openAskEffect } from './ask-bubble'
import { currentTarget } from './current-target'
import {
  acceptAtCursor,
  type EditorHandle,
  rejectAtCursor,
} from './suggestion-commands'

const openAsk: Command = (view) => {
  if (currentTarget(view.state) === undefined) return false
  view.dispatch({ effects: openAskEffect.of(null) })
  return true
}

const dismissBubble = (handle: EditorHandle): boolean => {
  if (!bubbleVisible(handle.state)) return false
  handle.dispatch({ effects: dismissBubbleEffect.of(null) })
  return true
}

export const escapeAtCursor = (handle: EditorHandle): boolean =>
  dismissBubble(handle) || rejectAtCursor(handle)

export const suggestionKeymap = Prec.highest(
  keymap.of([
    { key: 'Mod-k', run: openAsk, preventDefault: true },
    { key: 'Mod-Enter', run: acceptAtCursor },
    { key: 'Escape', run: escapeAtCursor },
  ]),
)
