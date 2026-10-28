import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { baseExtensions } from './extensions'

type EditorViewOptions = {
  readonly parent: HTMLElement
  readonly doc: string
  readonly onChange: (doc: string) => void
  readonly extensions?: readonly Extension[]
}

export const createEditorView = ({
  parent,
  doc,
  onChange,
  extensions = [],
}: EditorViewOptions): EditorView =>
  new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        ...baseExtensions,
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString())
        }),
      ],
    }),
  })
