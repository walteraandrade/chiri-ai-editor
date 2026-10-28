import {
  type ChangeDesc,
  type EditorState,
  StateEffect,
  StateField,
} from '@codemirror/state'
import {
  type EditorView,
  showTooltip,
  type Tooltip,
  type TooltipView,
} from '@codemirror/view'
import { QUICK_ACTIONS } from '../ai/quick-actions'
import {
  freeTextInstruction,
  quickActionInstruction,
} from '../suggestions/instruction'
import { currentTarget } from './current-target'
import { el } from './dom'
import { cycleTab } from './focus-cycle'
import { interactionField } from './interaction-state'
import { beginEffect } from './suggestion-field'
import { suggestionActionsFacet } from './suggestion-runtime'

type Range = { readonly from: number; readonly to: number }

type BubbleState = {
  readonly askOpen: boolean
  readonly dismissed: Range | null
}

export const openAskEffect = StateEffect.define<null>()
export const dismissBubbleEffect = StateEffect.define<null>()

const sameRange = (a: Range | null, b: Range): boolean =>
  a !== null && a.from === b.from && a.to === b.to

const mapRange = (range: Range, changes: ChangeDesc): Range => ({
  from: changes.mapPos(range.from, 1),
  to: changes.mapPos(range.to, -1),
})

export const bubbleField = StateField.define<BubbleState>({
  create: () => ({ askOpen: false, dismissed: null }),
  update: (value, transaction) => {
    const selection = transaction.state.selection.main
    const moved =
      transaction.docChanged ||
      !transaction.startState.selection.main.eq(selection)
    const opened = transaction.effects.some((effect) =>
      effect.is(openAskEffect),
    )
    const closed = transaction.effects.some(
      (effect) => effect.is(dismissBubbleEffect) || effect.is(beginEffect),
    )
    const mapped =
      value.dismissed && transaction.docChanged
        ? mapRange(value.dismissed, transaction.changes)
        : value.dismissed
    const askOpen = closed ? false : opened ? true : value.askOpen && !moved
    const dismissed = closed
      ? { from: selection.from, to: selection.to }
      : sameRange(mapped, selection)
        ? mapped
        : null
    return { askOpen, dismissed }
  },
})

export const bubbleVisible = (state: EditorState): boolean => {
  const { askOpen, dismissed } = state.field(bubbleField)
  const { focused, pointerDown } = state.field(interactionField)
  if (!focused) return false
  if (askOpen) return currentTarget(state) !== undefined
  const selection = state.selection.main
  return (
    !pointerDown &&
    !selection.empty &&
    !sameRange(dismissed, selection) &&
    currentTarget(state) !== undefined
  )
}

const isAsking = (state: EditorState): boolean =>
  state.field(bubbleField).askOpen

export const targetPreviewRange = (state: EditorState): Range | undefined => {
  if (!isAsking(state) || !state.selection.main.empty) return undefined
  return currentTarget(state)
}

const buildBubble = (view: EditorView) => {
  const actions = () => view.state.facet(suggestionActionsFacet)

  const input = el('input', {
    class: 'cm-ai-bubble-input',
    attrs: {
      type: 'text',
      placeholder: 'Ask AI…',
      'aria-label': 'Ask AI',
      autocomplete: 'off',
      spellcheck: 'false',
    },
    on: {
      keydown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          input.value = ''
          view.dispatch({ effects: dismissBubbleEffect.of(null) })
          view.focus()
        } else if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
        }
      },
    },
  })

  const form = el(
    'form',
    {
      class: 'cm-ai-bubble-ask',
      on: {
        submit: (event) => {
          event.preventDefault()
          const text = input.value.trim()
          if (text === '') return
          input.value = ''
          actions()?.ask(view, freeTextInstruction(text))
          view.focus()
        },
      },
    },
    [input],
  )

  const buttons = QUICK_ACTIONS.map((action) =>
    el(
      'button',
      {
        class: 'cm-ai-chip',
        attrs: { type: 'button' },
        on: {
          mousedown: (event) => event.preventDefault(),
          click: () => {
            actions()?.ask(view, quickActionInstruction(action.id))
            view.focus()
          },
        },
      },
      [action.label],
    ),
  )

  const dom = el(
    'div',
    {
      class: 'cm-ai-bubble',
      attrs: { role: 'group', 'aria-label': 'Ask AI' },
      on: {
        mousedown: (event) => {
          if (event.target !== input) event.preventDefault()
        },
        keydown: (event) => {
          if (event.key !== 'Escape') return cycleTab(dom, event)
          event.preventDefault()
          view.dispatch({ effects: dismissBubbleEffect.of(null) })
          view.focus()
        },
      },
    },
    [
      el(
        'div',
        { class: 'cm-ai-bubble-actions', attrs: { role: 'toolbar' } },
        buttons,
      ),
      form,
    ],
  )

  const focusIfAsking = (state: EditorState): void => {
    if (isAsking(state)) input.focus()
  }

  const tooltipView: TooltipView = {
    dom,
    mount: () => focusIfAsking(view.state),
    update: (update) => {
      const reopened = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(openAskEffect)),
      )
      if (reopened) focusIfAsking(update.state)
    },
  }
  return tooltipView
}

const bubbleTooltip = (state: EditorState): Tooltip | null => {
  if (!bubbleVisible(state)) return null
  const target = currentTarget(state)
  return target ? { pos: target.from, above: true, create: buildBubble } : null
}

export const askBubble = [
  bubbleField,
  showTooltip.compute(
    [bubbleField, interactionField, 'selection', 'doc'],
    bubbleTooltip,
  ),
]
