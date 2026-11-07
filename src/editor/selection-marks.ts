import { type EditorState, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'

export type SelectedRange = { readonly from: number; readonly to: number }

const selectedMark = Decoration.mark({ class: 'cm-selected-text' })

class EmptyLineMark extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-selected-text cm-selected-empty-line'
    span.textContent = ' '
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

const emptyLineMark = Decoration.widget({
  widget: new EmptyLineMark(),
  side: 1,
})

export const selectedRanges = (state: EditorState): readonly SelectedRange[] =>
  state.selection.ranges
    .filter((range) => !range.empty)
    .map(({ from, to }) => ({ from, to }))
    .sort((a, b) => a.from - b.from)

const linesIn = (state: EditorState, { from, to }: SelectedRange) =>
  Array.from(
    {
      length: state.doc.lineAt(to).number - state.doc.lineAt(from).number + 1,
    },
    (_, index) => state.doc.line(state.doc.lineAt(from).number + index),
  )

export const selectedEmptyLines = (state: EditorState): readonly number[] =>
  selectedRanges(state).flatMap((range) =>
    linesIn(state, range)
      .filter(
        (line) =>
          line.length === 0 && line.from >= range.from && line.from < range.to,
      )
      .map((line) => line.from),
  )

const buildMarks = (state: EditorState): DecorationSet =>
  Decoration.set(
    [
      ...selectedRanges(state).map(({ from, to }) =>
        selectedMark.range(from, to),
      ),
      ...selectedEmptyLines(state).map((at) => emptyLineMark.range(at)),
    ],
    true,
  )

export const selectionMarks = StateField.define<DecorationSet>({
  create: buildMarks,
  update: (marks, transaction) =>
    transaction.selection || transaction.docChanged
      ? buildMarks(transaction.state)
      : marks,
  provide: (field) => EditorView.decorations.from(field),
})
