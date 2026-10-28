import { StateEffect, StateField } from '@codemirror/state'
import { type EditorView, ViewPlugin } from '@codemirror/view'
import type { SuggestionId } from '../suggestions/types'

export type InteractionState = {
  readonly pointerDown: boolean
  readonly focused: boolean
  readonly hoveredId: SuggestionId | null
}

const pointerEffect = StateEffect.define<boolean>()
const focusEffect = StateEffect.define<boolean>()
const hoverEffect = StateEffect.define<SuggestionId | null>()

const applyInteraction = (
  state: InteractionState,
  effect: StateEffect<unknown>,
): InteractionState => {
  if (effect.is(pointerEffect)) return { ...state, pointerDown: effect.value }
  if (effect.is(focusEffect)) return { ...state, focused: effect.value }
  if (effect.is(hoverEffect)) return { ...state, hoveredId: effect.value }
  return state
}

export const interactionField = StateField.define<InteractionState>({
  create: () => ({ pointerDown: false, focused: false, hoveredId: null }),
  update: (value, transaction) =>
    transaction.effects.reduce(applyInteraction, value),
})

const suggestionIdOf = (target: EventTarget | null): SuggestionId | null =>
  target instanceof Element
    ? (target.closest<HTMLElement>('[data-suggestion-id]')?.dataset
        .suggestionId ?? null)
    : null

const interactionPlugin = ViewPlugin.define((view: EditorView) => {
  const setHover = (id: SuggestionId | null): void => {
    if (view.state.field(interactionField).hoveredId !== id)
      view.dispatch({ effects: hoverEffect.of(id) })
  }
  const onMouseDown = (): void =>
    view.dispatch({ effects: pointerEffect.of(true) })
  const onMouseUp = (): void => {
    if (view.state.field(interactionField).pointerDown)
      view.dispatch({ effects: pointerEffect.of(false) })
  }
  const onMouseOver = (event: MouseEvent): void =>
    setHover(suggestionIdOf(event.target))
  const onMouseLeave = (): void => setHover(null)
  const setFocused = (focused: boolean): void =>
    queueMicrotask(() => {
      if (
        view.dom.isConnected &&
        view.state.field(interactionField).focused !== focused
      )
        view.dispatch({ effects: focusEffect.of(focused) })
    })
  const onFocusIn = (): void => setFocused(true)
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget
    if (!(next instanceof Node && view.dom.contains(next))) setFocused(false)
  }

  view.contentDOM.addEventListener('mousedown', onMouseDown)
  view.contentDOM.addEventListener('mouseover', onMouseOver)
  view.contentDOM.addEventListener('mouseleave', onMouseLeave)
  view.dom.addEventListener('focusin', onFocusIn)
  view.dom.addEventListener('focusout', onFocusOut)
  document.addEventListener('mouseup', onMouseUp)

  return {
    destroy: () => {
      view.contentDOM.removeEventListener('mousedown', onMouseDown)
      view.contentDOM.removeEventListener('mouseover', onMouseOver)
      view.contentDOM.removeEventListener('mouseleave', onMouseLeave)
      view.dom.removeEventListener('focusin', onFocusIn)
      view.dom.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('mouseup', onMouseUp)
    },
  }
})

export const interactionState = [interactionField, interactionPlugin]
