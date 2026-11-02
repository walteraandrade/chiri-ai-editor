import { type FieldEditPlan, planFieldEdit } from '../skills/frontmatter-edit'
import type { SkillFieldValues } from '../skills/frontmatter-fields'
import { textOf } from './current-target'
import type { EditorHandle } from './suggestion-commands'

export const applySkillFields = (
  handle: EditorHandle,
  values: SkillFieldValues,
): FieldEditPlan => {
  const plan = planFieldEdit(textOf(handle.state), values)
  if (plan.kind === 'change')
    handle.dispatch({ changes: plan.change, userEvent: 'input.type' })
  return plan
}
