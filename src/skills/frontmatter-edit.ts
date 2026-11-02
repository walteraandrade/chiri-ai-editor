import {
  type FrontmatterProblem,
  planSkillFieldEdits,
  type SkillFieldValues,
  type TextEdit,
} from './frontmatter-fields'

export type TextChange = TextEdit

export type FieldEditPlan =
  | { readonly kind: 'change'; readonly changes: readonly TextChange[] }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly problem: FrontmatterProblem }

export const applyChanges = (
  text: string,
  changes: readonly TextChange[],
): string =>
  changes
    .toSorted((a, b) => b.from - a.from)
    .reduce(
      (result, { from, to, insert }) =>
        result.slice(0, from) + insert + result.slice(to),
      text,
    )

export const planFieldEdit = (
  text: string,
  values: SkillFieldValues,
): FieldEditPlan => {
  const plan = planSkillFieldEdits(text, values)
  if (!plan.ok) return { kind: 'refused', problem: plan.problem }
  return plan.edits.length === 0
    ? { kind: 'unchanged' }
    : { kind: 'change', changes: plan.edits }
}
