import {
  type ChangeDesc,
  type EditorState,
  Facet,
  StateEffect,
  StateField,
} from '@codemirror/state'
import {
  type EditorView,
  type Rect,
  showTooltip,
  type Tooltip,
  type TooltipView,
} from '@codemirror/view'
import {
  DEFAULT_QUICK_ACTION_IDS,
  type QuickActionId,
  quickActionsFor,
} from '../ai/quick-actions'
import {
  freeTextInstruction,
  quickActionInstruction,
} from '../suggestions/instruction'
import { aiFlag } from './ai-flag'
import {
  type AskMenu,
  type AskRow,
  askHint,
  chosenRow,
  EMPTY_ASK_MENU,
  hintVisible,
  hoverAskMenu,
  menuRows,
  moveAskMenu,
  typeAskMenu,
} from './ask-menu'
import { currentTarget, frontmatterOfDoc } from './current-target'
import { el } from './dom'
import { cycleTab } from './focus-cycle'
import { interactionField } from './interaction-state'
import { inViewCoords, textRectAt } from './keep-in-view'
import { beginEffect } from './suggestion-field'
import { suggestionActionsFacet } from './suggestion-runtime'

type Range = { readonly from: number; readonly to: number }

type BubbleState = {
  readonly askOpen: boolean
  readonly dismissed: Range | null
}

export const quickActionIdsFacet = Facet.define<
  readonly QuickActionId[],
  readonly QuickActionId[]
>({
  combine: (values) => values.at(-1) ?? DEFAULT_QUICK_ACTION_IDS,
})

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

const bubbleCoords = (view: EditorView, pos: number): Rect => {
  const left = view.contentDOM.getBoundingClientRect().left
  return inViewCoords(
    view,
    textRectAt(view, pos, left),
    currentTarget(view.state) ?? { from: pos, to: pos },
    left,
  )
}

const highlighted = (
  label: string,
  match: { readonly from: number; readonly to: number } | null,
): readonly (Node | string)[] =>
  match === null
    ? [label]
    : [
        label.slice(0, match.from),
        el('mark', {}, [label.slice(match.from, match.to)]),
        label.slice(match.to),
      ]

const rowContent = (row: AskRow): readonly Node[] =>
  row.kind === 'free'
    ? [el('span', {}, [`Ask AI: “${row.text}”`])]
    : [
        el('span', {}, highlighted(row.action.label, row.match)),
        ...(row.action.skillOnly
          ? [el('span', { class: 'cm-ai-ask-tag' }, ['Skill'])]
          : []),
      ]

let bubbleCount = 0

const buildBubble = (view: EditorView) => {
  const actions = () => view.state.facet(suggestionActionsFacet)
  const quickActions = quickActionsFor(
    frontmatterOfDoc(view.state.doc) !== undefined,
    view.state.facet(quickActionIdsFacet),
  )
  bubbleCount += 1
  const listId = `cm-ai-ask-list-${bubbleCount}`
  const hintId = `${listId}-hint`
  const optionId = (index: number) => `${listId}-${index}`

  let menu = EMPTY_ASK_MENU

  const run = (row: AskRow): void => {
    input.value = ''
    show(EMPTY_ASK_MENU)
    actions()?.ask(
      view,
      row.kind === 'free'
        ? freeTextInstruction(row.text)
        : quickActionInstruction(row.action.id),
    )
    view.focus()
  }

  const paintActive = (): void => {
    for (const [index, item] of [...list.children].entries()) {
      item.setAttribute('aria-selected', String(index === menu.active))
    }
    const item = list.children[menu.active]
    if (item) {
      input.setAttribute('aria-activedescendant', item.id)
      item.scrollIntoView({ block: 'nearest' })
    } else input.removeAttribute('aria-activedescendant')
  }

  const highlight = (next: AskMenu): void => {
    menu = next
    paintActive()
  }

  const show = (next: AskMenu): void => {
    menu = next
    const rows = menuRows(quickActions, menu)
    list.replaceChildren(
      ...rows.map((row, index) =>
        el(
          'div',
          {
            class:
              row.kind === 'free'
                ? 'cm-ai-ask-item cm-ai-ask-free'
                : 'cm-ai-ask-item',
            attrs: { role: 'option', id: optionId(index) },
            on: {
              mousemove: () => highlight(hoverAskMenu(menu, index)),
              click: () => run(row),
            },
          },
          rowContent(row),
        ),
      ),
    )
    list.hidden = rows.length === 0
    input.setAttribute('aria-expanded', String(rows.length > 0))
    if (hint) hint.hidden = !hintVisible(menu)
    paintActive()
  }

  const input = el('input', {
    class: 'cm-ai-bubble-input',
    attrs: {
      type: 'text',
      placeholder: 'Ask AI, or type an action…',
      'aria-label': 'Ask AI',
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-controls': listId,
      'aria-expanded': 'false',
      'aria-describedby': hintId,
      autocomplete: 'off',
      spellcheck: 'false',
    },
    on: {
      input: () => show(typeAskMenu(input.value)),
      keydown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          input.value = ''
          view.dispatch({ effects: dismissBubbleEffect.of(null) })
          view.focus()
        } else if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const next = moveAskMenu(
            quickActions,
            menu,
            event.key === 'ArrowDown' ? 1 : -1,
          )
          if (next.browsing !== menu.browsing) show(next)
          else highlight(next)
        }
      },
    },
  })

  const list = el('div', {
    class: 'cm-ai-ask-list',
    attrs: { id: listId, role: 'listbox', 'aria-label': 'Quick actions' },
  })

  const hintText = askHint(quickActions)
  const hint =
    hintText === undefined
      ? undefined
      : el('div', { class: 'cm-ai-ask-hint', attrs: { id: hintId } }, [
          hintText,
        ])

  const form = el(
    'form',
    {
      class: 'cm-ai-bubble-ask',
      on: {
        submit: (event) => {
          event.preventDefault()
          const row = chosenRow(quickActions, menu)
          if (row) run(row)
        },
      },
    },
    [aiFlag(), input],
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
    [form, ...(hint ? [hint] : []), list],
  )

  show(EMPTY_ASK_MENU)

  const focusIfAsking = (state: EditorState): void => {
    if (isAsking(state)) input.focus()
  }

  const tooltipView: TooltipView = {
    dom,
    getCoords: (pos) => bubbleCoords(view, pos),
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

type Placement = { readonly pos: number; readonly above: boolean }

export const bubblePlacement = (state: EditorState): Placement | undefined => {
  const target = currentTarget(state)
  if (target === undefined) return undefined
  const { anchor, head, empty } = state.selection.main
  return empty
    ? { pos: target.from, above: true }
    : { pos: head, above: head < anchor }
}

const bubbleTooltip = (state: EditorState): Tooltip | null => {
  if (!bubbleVisible(state)) return null
  const placement = bubblePlacement(state)
  return placement ? { ...placement, clip: false, create: buildBubble } : null
}

export const askBubble = [
  bubbleField,
  showTooltip.compute(
    [bubbleField, interactionField, 'selection', 'doc'],
    bubbleTooltip,
  ),
]
