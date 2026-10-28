import type { EditorState } from '@codemirror/state'
import {
  type EditorView,
  showTooltip,
  type Tooltip,
  type TooltipView,
  type ViewUpdate,
} from '@codemirror/view'
import { describeError } from '../suggestions/error-message'
import { freeTextInstruction } from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import type { ReadySuggestion, SuggestionId } from '../suggestions/types'
import { detectApplePlatform, formatShortcut } from '../ui/platform'
import { el } from './dom'
import { interactionField } from './interaction-state'
import {
  closeRefineEffect,
  openRefineEffect,
  refineInputOpenFor,
} from './refine-input'
import {
  acceptSuggestionById,
  rejectSuggestionById,
} from './suggestion-commands'
import {
  activeOf,
  cursorOf,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'
import { suggestionActionsFacet } from './suggestion-runtime'

type CardContent = {
  readonly suggestion: ReadySuggestion
  readonly showRationale: boolean
  readonly showActions: boolean
  readonly refineOpen: boolean
}

type CardKind = 'active' | 'hover'

const contentFor = (
  kind: CardKind,
  state: EditorState,
): CardContent | undefined => {
  const hoveredId = state.field(interactionField).hoveredId
  const active = activeOf(state)
  if (kind === 'active') {
    if (!active) return undefined
    const cursorInside =
      active.from <= cursorOf(state) && cursorOf(state) <= active.to
    return {
      suggestion: active,
      showRationale: cursorInside || hoveredId === active.id,
      showActions: true,
      refineOpen: refineInputOpenFor(state) === active.id,
    }
  }
  if (hoveredId === null || hoveredId === active?.id) return undefined
  const hovered = findSuggestion(suggestionsOf(state), hoveredId)
  return hovered?.status === 'ready'
    ? {
        suggestion: hovered,
        showRationale: true,
        showActions: false,
        refineOpen: false,
      }
    : undefined
}

const refineKey = ({ refine }: ReadySuggestion): string =>
  refine.status === 'failed'
    ? `failed:${describeError(refine.error)}`
    : refine.status

const contentKey = ({
  suggestion,
  showRationale,
  showActions,
  refineOpen,
}: CardContent): string =>
  [
    suggestion.id,
    suggestion.rationale,
    showRationale,
    showActions,
    refineOpen,
    refineKey(suggestion),
  ].join('\u0000')

const shortcutLabel = (key: string): string =>
  formatShortcut(key, detectApplePlatform())

type ButtonOptions = {
  readonly refocus?: boolean
  readonly disabled?: boolean
  readonly busy?: boolean
  readonly expanded?: boolean
}

const actionButton = (
  view: EditorView,
  label: string,
  hint: string | undefined,
  run: () => void,
  {
    refocus = true,
    disabled = false,
    busy = false,
    expanded,
  }: ButtonOptions = {},
) =>
  el(
    'button',
    {
      class: 'cm-ai-button',
      attrs: {
        type: 'button',
        ...(disabled && { disabled: '' }),
        ...(busy && { 'aria-busy': 'true' }),
        ...(expanded !== undefined && { 'aria-expanded': String(expanded) }),
      },
      on: {
        mousedown: (event) => event.preventDefault(),
        click: () => {
          run()
          if (refocus) view.focus()
        },
      },
    },
    hint === undefined
      ? [label]
      : [label, el('kbd', { class: 'cm-ai-kbd' }, [hint])],
  )

type RefineForm = {
  readonly form: HTMLFormElement
  readonly input: HTMLInputElement
}

const createRefineForm = (view: EditorView): RefineForm => {
  const input = el('input', {
    class: 'cm-ai-bubble-input',
    attrs: {
      type: 'text',
      placeholder: 'Refine: make it shorter…',
      'aria-label': 'Refine instruction',
      autocomplete: 'off',
      spellcheck: 'false',
    },
    on: {
      keydown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          input.value = ''
          view.dispatch({ effects: closeRefineEffect.of(null) })
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
      class: 'cm-ai-refine',
      on: {
        submit: (event) => {
          event.preventDefault()
          const id = refineInputOpenFor(view.state)
          const text = input.value.trim()
          if (id === null || text === '') return
          input.value = ''
          view.state
            .facet(suggestionActionsFacet)
            ?.refine(view, id, freeTextInstruction(text))
          view.focus()
        },
      },
    },
    [input],
  )
  return { form, input }
}

const refineButton = (
  view: EditorView,
  { suggestion, refineOpen }: CardContent,
) =>
  suggestion.refine.status === 'working'
    ? actionButton(view, 'Refining…', undefined, () => undefined, {
        disabled: true,
        busy: true,
      })
    : actionButton(
        view,
        'Refine',
        shortcutLabel('K'),
        () =>
          view.dispatch({
            effects: refineOpen
              ? closeRefineEffect.of(null)
              : openRefineEffect.of(suggestion.id),
          }),
        { refocus: refineOpen, expanded: refineOpen },
      )

const refineError = (
  view: EditorView,
  { refine, id }: ReadySuggestion,
  withRetry: boolean,
) =>
  refine.status === 'failed'
    ? [
        el('div', { class: 'cm-ai-card-error', attrs: { role: 'alert' } }, [
          el('span', { class: 'cm-ai-error-message' }, [
            describeError(refine.error),
          ]),
          ...(withRetry
            ? [
                actionButton(view, 'Retry', undefined, () =>
                  view.state
                    .facet(suggestionActionsFacet)
                    ?.retryRefine(view, id),
                ),
              ]
            : []),
        ]),
      ]
    : []

const renderCard = (
  view: EditorView,
  content: CardContent,
  { form }: RefineForm,
): Node[] => {
  const { suggestion, showRationale, showActions, refineOpen } = content
  return [
    ...(showRationale
      ? [el('p', { class: 'cm-ai-rationale' }, [suggestion.rationale])]
      : []),
    ...(showActions
      ? [
          el('div', { class: 'cm-ai-card-actions' }, [
            actionButton(view, 'Accept', shortcutLabel('↵'), () =>
              acceptSuggestionById(view, suggestion.id),
            ),
            actionButton(view, 'Reject', 'Esc', () =>
              rejectSuggestionById(view, suggestion.id),
            ),
            refineButton(view, content),
          ]),
          ...(refineOpen ? [form] : []),
        ]
      : []),
    ...refineError(view, suggestion, showActions),
  ]
}

const openedRefine = (update: ViewUpdate): boolean =>
  update.transactions.some((transaction) =>
    transaction.effects.some((effect) => effect.is(openRefineEffect)),
  )

const cardCreator =
  (kind: CardKind) =>
  (view: EditorView): TooltipView => {
    const refineForm = createRefineForm(view)
    const dom = el('div', {
      class: `cm-ai-card cm-ai-card-${kind}`,
      attrs:
        kind === 'active' ? { role: 'group', 'aria-label': 'Suggestion' } : {},
      on: {
        mousedown: (event) => {
          if (event.target !== refineForm.input) event.preventDefault()
        },
      },
    })
    let renderedKey = ''
    let formOwner: SuggestionId | null = null
    const syncFormOwner = (state: EditorState): void => {
      const next = refineInputOpenFor(state)
      if (next === formOwner) return
      formOwner = next
      refineForm.input.value = ''
    }
    const sync = (state: EditorState): void => {
      syncFormOwner(state)
      const content = contentFor(kind, state)
      if (!content) return
      const key = contentKey(content)
      if (key === renderedKey) return
      renderedKey = key
      const hadFocus =
        refineForm.input.ownerDocument.activeElement === refineForm.input
      dom.replaceChildren(...renderCard(view, content, refineForm))
      if (hadFocus && refineForm.form.isConnected) refineForm.input.focus()
    }
    sync(view.state)
    return {
      dom,
      update: (update) => {
        sync(update.state)
        if (openedRefine(update) && refineForm.form.isConnected)
          refineForm.input.focus()
      },
    }
  }

const createActiveCard = cardCreator('active')
const createHoverCard = cardCreator('hover')

const tooltipFor = (
  kind: CardKind,
  state: EditorState,
  create: (view: EditorView) => TooltipView,
): Tooltip | null => {
  const content = contentFor(kind, state)
  return content ? { pos: content.suggestion.from, above: true, create } : null
}

export const suggestionCards = showTooltip.computeN(
  [suggestionsField, interactionField, 'selection'],
  (state) => [
    tooltipFor('active', state, createActiveCard),
    tooltipFor('hover', state, createHoverCard),
  ],
)
