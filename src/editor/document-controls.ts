import { redo, undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import type { FieldEditPlan } from '../skills/frontmatter-edit'
import type { SkillFieldValues } from '../skills/frontmatter-fields'
import { textOf } from './current-target'
import { refreshDocument, replaceDocument } from './document-commands'
import { applySkillFields } from './frontmatter-commands'

export type DocumentControls = {
  readonly text: () => string
  readonly replace: (text: string) => void
  readonly refresh: (text: string) => void
  readonly restore: (text: string) => void
  readonly focus: () => void
  readonly setSkillFields: (values: SkillFieldValues) => FieldEditPlan
  readonly undo: () => void
  readonly redo: () => void
}

export const bindDocumentControls = (view: EditorView): DocumentControls => ({
  text: () => textOf(view.state),
  replace: (text) => {
    replaceDocument(view, text)
    view.focus()
  },
  refresh: (text) => refreshDocument(view, text),
  restore: (text) => replaceDocument(view, text, 'input.restore'),
  focus: () => view.focus(),
  setSkillFields: (values) => applySkillFields(view, values),
  undo: () => {
    undo(view)
  },
  redo: () => {
    redo(view)
  },
})
