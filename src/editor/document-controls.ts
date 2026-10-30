import type { EditorView } from '@codemirror/view'
import { textOf } from './current-target'
import { replaceDocument } from './document-commands'

export type DocumentControls = {
  readonly text: () => string
  readonly replace: (text: string) => void
}

export const bindDocumentControls = (view: EditorView): DocumentControls => ({
  text: () => textOf(view.state),
  replace: (text) => {
    replaceDocument(view, text)
    view.focus()
  },
})
