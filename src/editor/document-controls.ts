import type { EditorView } from '@codemirror/view'
import { textOf } from './current-target'
import { replaceDocument } from './document-commands'

export type DocumentControls = {
  readonly text: () => string
  readonly replace: (text: string) => void
  readonly restore: (text: string) => void
  readonly focus: () => void
}

export const bindDocumentControls = (view: EditorView): DocumentControls => ({
  text: () => textOf(view.state),
  replace: (text) => {
    replaceDocument(view, text)
    view.focus()
  },
  restore: (text) => replaceDocument(view, text, 'input.restore'),
  focus: () => view.focus(),
})
