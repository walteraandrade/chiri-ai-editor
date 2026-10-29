import { Prec } from '@codemirror/state'
import { type EditorView, keymap } from '@codemirror/view'
import { bubbleVisible, dismissBubbleEffect, openAskEffect } from './ask-bubble'
import { currentTarget } from './current-target'
import { focusEdge } from './focus-cycle'
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
  showVersionEffect,
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

export const stepVersionAtCursor =
  (offset: number) =>
  (handle: EditorHandle): boolean => {
    const found = suggestionAtCursor(handle.state)
    if (found?.status !== 'ready' || found.history.length < 2) return false
    handle.dispatch({
      effects: showVersionEffect.of({
        id: found.id,
        index: found.shown + offset,
      }),
    })
    return true
  }

export const escapeAtCursor = (handle: EditorHandle): boolean =>
  dismissBubble(handle) ||
  closeRefineInput(handle) ||
  cancelRefineAtCursor(handle) ||
  rejectAtCursor(handle)

const focusOpenCard =
  (backward: boolean) =>
  (view: EditorView): boolean => {
    const card =
      view.dom.querySelector<HTMLElement>('.cm-ai-bubble') ??
      view.dom.querySelector<HTMLElement>('.cm-ai-card-active')
    return card !== null && focusEdge(card, backward)
  }

export const suggestionKeymap = Prec.highest(
  keymap.of([
    { key: 'Mod-k', run: openAskOrRefine, preventDefault: true },
    { key: 'Mod-Enter', run: acceptAtCursor },
    { key: 'Escape', run: escapeAtCursor },
    { key: 'Ctrl-h', run: stepVersionAtCursor(-1) },
    { key: 'Ctrl-l', run: stepVersionAtCursor(1) },
    { key: 'Tab', run: focusOpenCard(false), shift: focusOpenCard(true) },
  ]),
)
