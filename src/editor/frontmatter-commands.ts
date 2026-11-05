import { ChangeSet } from '@codemirror/state'
import { type FieldEditPlan, planFieldEdit } from '../skills/frontmatter-edit'
import type { SkillFieldValues } from '../skills/frontmatter-fields'
import { textOf } from './current-target'
import type { EditorHandle } from './suggestion-commands'

export const applySkillFields = (
  handle: EditorHandle,
  values: SkillFieldValues,
): FieldEditPlan => {
  const { state } = handle
  const plan = planFieldEdit(textOf(state), values)
  if (plan.kind === 'change')
    handle.dispatch({
      changes: plan.changes,
      selection: state.selection.map(
        ChangeSet.of(plan.changes, state.doc.length),
        1,
      ),
      userEvent: 'input.type',
    })
  return plan
}
