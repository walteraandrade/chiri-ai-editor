import { type EditorState, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { textOf } from './current-target'
import { type FrontmatterMark, frontmatterMarks } from './frontmatter-marks'

const delimiterLine = Decoration.line({
  class: 'cm-frontmatter-line cm-frontmatter-delimiter',
})
const bodyLine = Decoration.line({ class: 'cm-frontmatter-line' })
const keyMark = Decoration.mark({ class: 'cm-frontmatter-key' })

const decorationOf = (mark: FrontmatterMark) =>
  mark.kind === 'key'
    ? keyMark.range(mark.from, mark.to)
    : (mark.role === 'delimiter' ? delimiterLine : bodyLine).range(mark.from)

const buildDecorations = (state: EditorState): DecorationSet =>
  state.doc.line(1).text.startsWith('---')
    ? Decoration.set(frontmatterMarks(textOf(state)).map(decorationOf), true)
    : Decoration.none

export const frontmatterStyle = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, transaction) =>
    transaction.docChanged ? buildDecorations(transaction.state) : decorations,
  provide: (field) => EditorView.decorations.from(field),
})
