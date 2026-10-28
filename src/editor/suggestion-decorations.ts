import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import { describeError } from '../suggestions/error-message'
import type {
  ReadySuggestion,
  Suggestion,
  SuggestionId,
} from '../suggestions/types'
import { bubbleField, targetPreviewRange } from './ask-bubble'
import { el } from './dom'
import { rejectSuggestionById } from './suggestion-commands'
import { activeOf, suggestionsField, suggestionsOf } from './suggestion-field'
import { suggestionActionsFacet } from './suggestion-runtime'

const idAttributes = (id: SuggestionId) => ({ 'data-suggestion-id': id })

class InsertedWidget extends WidgetType {
  constructor(
    readonly id: SuggestionId,
    readonly text: string,
    readonly separated: boolean,
  ) {
    super()
  }

  eq(other: InsertedWidget): boolean {
    return (
      other.id === this.id &&
      other.text === this.text &&
      other.separated === this.separated
    )
  }

  toDOM(): HTMLElement {
    return el(
      'ins',
      {
        class: `cm-ai-inserted${this.separated ? ' cm-ai-inserted-separated' : ''}`,
        attrs: idAttributes(this.id),
      },
      [this.text],
    )
  }

  ignoreEvent(): boolean {
    return false
  }
}

class ReplacementWidget extends WidgetType {
  constructor(
    readonly id: SuggestionId,
    readonly text: string,
  ) {
    super()
  }

  eq(other: ReplacementWidget): boolean {
    return other.id === this.id && other.text === this.text
  }

  toDOM(): HTMLElement {
    return el(
      'div',
      {
        class: 'cm-ai-replacement',
        attrs: idAttributes(this.id),
      },
      [el('ins', {}, [this.text])],
    )
  }

  ignoreEvent(): boolean {
    return false
  }
}

class ErrorCardWidget extends WidgetType {
  constructor(
    readonly id: SuggestionId,
    readonly message: string,
  ) {
    super()
  }

  eq(other: ErrorCardWidget): boolean {
    return other.id === this.id && other.message === this.message
  }

  toDOM(view: EditorView): HTMLElement {
    const button = (label: string, onClick: () => void) =>
      el(
        'button',
        {
          class: 'cm-ai-button',
          attrs: { type: 'button' },
          on: {
            mousedown: (event) => event.preventDefault(),
            click: () => {
              onClick()
              view.focus()
            },
          },
        },
        [label],
      )
    return el(
      'div',
      {
        class: 'cm-ai-error',
        attrs: { role: 'alert', ...idAttributes(this.id) },
      },
      [
        el('span', { class: 'cm-ai-error-message' }, [this.message]),
        el('span', { class: 'cm-ai-error-actions' }, [
          button('Retry', () =>
            view.state.facet(suggestionActionsFacet)?.retry(view, this.id),
          ),
          button('Dismiss', () => rejectSuggestionById(view, this.id)),
        ]),
      ],
    )
  }

  ignoreEvent(): boolean {
    return true
  }
}

const pendingMark = (id: SuggestionId) =>
  Decoration.mark({
    class: 'cm-ai-pending',
    attributes: { ...idAttributes(id), 'aria-busy': 'true' },
  })

const failedMark = (id: SuggestionId) =>
  Decoration.mark({
    class: 'cm-ai-failed',
    attributes: idAttributes(id),
  })

const suggestionMark = (id: SuggestionId, active: boolean) =>
  Decoration.mark({
    class: active ? 'cm-ai-suggestion cm-ai-active' : 'cm-ai-suggestion',
    attributes: idAttributes(id),
  })

const deletedMark = (id: SuggestionId) =>
  Decoration.mark({
    tagName: 'del',
    class: 'cm-ai-deleted',
    attributes: idAttributes(id),
  })

const readyRanges = (
  suggestion: ReadySuggestion,
  active: boolean,
): readonly Range<Decoration>[] => {
  const { id, from, to, diff } = suggestion
  const hunks = diff.hunks.flatMap((hunk, index): Range<Decoration>[] => {
    if (hunk.type === 'deleted') {
      return hunk.from === hunk.to
        ? []
        : [deletedMark(id).range(from + hunk.from, from + hunk.to)]
    }
    if (hunk.type !== 'inserted') return []
    if (diff.mode === 'block') {
      return [
        Decoration.widget({
          widget: new ReplacementWidget(id, hunk.text),
          block: true,
          side: 1,
        }).range(to),
      ]
    }
    const separated = diff.hunks[index - 1]?.type === 'deleted'
    return [
      Decoration.widget({
        widget: new InsertedWidget(id, hunk.text, separated),
        side: 1,
      }).range(from + hunk.at),
    ]
  })
  return [suggestionMark(id, active).range(from, to), ...hunks]
}

const suggestionRanges = (
  suggestion: Suggestion,
  active: boolean,
): readonly Range<Decoration>[] => {
  switch (suggestion.status) {
    case 'pending':
      return [pendingMark(suggestion.id).range(suggestion.from, suggestion.to)]
    case 'error':
      return [
        failedMark(suggestion.id).range(suggestion.from, suggestion.to),
        Decoration.widget({
          widget: new ErrorCardWidget(
            suggestion.id,
            describeError(suggestion.error),
          ),
          block: true,
          side: 1,
        }).range(suggestion.to),
      ]
    case 'ready':
      return readyRanges(suggestion, active)
  }
}

const targetPreview = Decoration.mark({ class: 'cm-ai-target-preview' })

export const buildDecorations = (state: EditorState): DecorationSet => {
  const active = activeOf(state)
  const preview = targetPreviewRange(state)
  return Decoration.set(
    [
      ...suggestionsOf(state).items.flatMap((suggestion) =>
        suggestionRanges(suggestion, suggestion.id === active?.id),
      ),
      ...(preview ? [targetPreview.range(preview.from, preview.to)] : []),
    ],
    true,
  )
}

export const suggestionDecorations = EditorView.decorations.compute(
  [suggestionsField, bubbleField, 'selection'],
  buildDecorations,
)
