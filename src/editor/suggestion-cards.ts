import type { EditorState } from '@codemirror/state'
import {
  type EditorView,
  showTooltip,
  type Tooltip,
  type TooltipView,
} from '@codemirror/view'
import { findSuggestion } from '../suggestions/state'
import type { ReadySuggestion } from '../suggestions/types'
import { detectApplePlatform, formatShortcut } from '../ui/platform'
import { el } from './dom'
import { interactionField } from './interaction-state'
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

type CardContent = {
  readonly suggestion: ReadySuggestion
  readonly showRationale: boolean
  readonly showActions: boolean
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
    }
  }
  if (hoveredId === null || hoveredId === active?.id) return undefined
  const hovered = findSuggestion(suggestionsOf(state), hoveredId)
  return hovered?.status === 'ready'
    ? { suggestion: hovered, showRationale: true, showActions: false }
    : undefined
}

const contentKey = ({
  suggestion,
  showRationale,
  showActions,
}: CardContent): string =>
  [suggestion.id, suggestion.rationale, showRationale, showActions].join(
    '\u0000',
  )

const shortcutLabel = (key: string): string =>
  formatShortcut(key, detectApplePlatform())

const actionButton = (
  view: EditorView,
  label: string,
  hint: string,
  run: () => void,
) =>
  el(
    'button',
    {
      class: 'cm-ai-button',
      attrs: { type: 'button' },
      on: {
        mousedown: (event) => event.preventDefault(),
        click: () => {
          run()
          view.focus()
        },
      },
    },
    [label, el('kbd', { class: 'cm-ai-kbd' }, [hint])],
  )

const renderCard = (view: EditorView, content: CardContent): Node[] => {
  const { suggestion, showRationale, showActions } = content
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
          ]),
        ]
      : []),
  ]
}

const cardCreator =
  (kind: CardKind) =>
  (view: EditorView): TooltipView => {
    const dom = el('div', {
      class: `cm-ai-card cm-ai-card-${kind}`,
      attrs:
        kind === 'active' ? { role: 'group', 'aria-label': 'Suggestion' } : {},
    })
    let renderedKey = ''
    const sync = (state: EditorState): void => {
      const content = contentFor(kind, state)
      if (!content) return
      const key = contentKey(content)
      if (key === renderedKey) return
      renderedKey = key
      dom.replaceChildren(...renderCard(view, content))
    }
    sync(view.state)
    return { dom, update: (update) => sync(update.state) }
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
