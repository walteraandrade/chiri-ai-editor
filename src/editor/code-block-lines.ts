import { syntaxTree } from '@codemirror/language'
import { type EditorState, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

const CODE_BLOCK_NODES: ReadonlySet<string> = new Set([
  'FencedCode',
  'CodeBlock',
])

type LineRange = { readonly first: number; readonly last: number }

const collectCodeBlockRanges = (state: EditorState): readonly LineRange[] => {
  const ranges: LineRange[] = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (!CODE_BLOCK_NODES.has(node.name)) return undefined
      ranges.push({
        first: state.doc.lineAt(node.from).number,
        last: state.doc.lineAt(node.to).number,
      })
      return false
    },
  })
  return ranges
}

export const codeBlockLineStarts = (state: EditorState): readonly number[] =>
  collectCodeBlockRanges(state).flatMap(({ first, last }) =>
    Array.from(
      { length: last - first + 1 },
      (_, index) => state.doc.line(first + index).from,
    ),
  )

const codeBlockLine = Decoration.line({ class: 'cm-codeblock-line' })

const buildDecorations = (state: EditorState): DecorationSet =>
  Decoration.set(
    codeBlockLineStarts(state).map((from) => codeBlockLine.range(from)),
  )

export const codeBlockLines = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, transaction) =>
    transaction.docChanged ||
    syntaxTree(transaction.state) !== syntaxTree(transaction.startState)
      ? buildDecorations(transaction.state)
      : decorations,
  provide: (field) => EditorView.decorations.from(field),
})
