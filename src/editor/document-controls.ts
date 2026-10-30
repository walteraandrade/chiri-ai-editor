import type { EditorView } from '@codemirror/view'
import { textOf } from './current-target'
import { replaceDocument } from './document-commands'
import { reviewActionsFacet } from './review-runtime'

export type DocumentControls = {
  readonly text: () => string
  readonly replace: (text: string) => void
}

export const bindDocumentControls = (view: EditorView): DocumentControls => ({
  text: () => textOf(view.state),
  replace: (text) => {
    view.state.facet(reviewActionsFacet)?.stop(view)
    replaceDocument(view, text)
    view.focus()
  },
})
