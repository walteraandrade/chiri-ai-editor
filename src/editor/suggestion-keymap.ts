import { Prec } from '@codemirror/state'
import { type Command, keymap } from '@codemirror/view'
import { bubbleVisible, dismissBubbleEffect, openAskEffect } from './ask-bubble'
import { currentTarget } from './current-target'
import { acceptAtCursor, rejectAtCursor } from './suggestion-commands'

const openAsk: Command = (view) => {
  if (currentTarget(view.state) === undefined) return false
  view.dispatch({ effects: openAskEffect.of(null) })
  return true
}

const dismissBubble: Command = (view) => {
  if (!bubbleVisible(view.state)) return false
  view.dispatch({ effects: dismissBubbleEffect.of(null) })
  return true
}

const rejectOrDismiss: Command = (view) =>
  rejectAtCursor(view) || dismissBubble(view)

export const suggestionKeymap = Prec.highest(
  keymap.of([
    { key: 'Mod-k', run: openAsk, preventDefault: true },
    { key: 'Mod-Enter', run: acceptAtCursor },
    { key: 'Escape', run: rejectOrDismiss },
  ]),
)
