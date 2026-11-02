import {
  type FrontmatterProblem,
  type SkillFieldValues,
  setSkillFields,
} from './frontmatter-fields'

export type TextChange = {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export type FieldEditPlan =
  | { readonly kind: 'change'; readonly change: TextChange }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly problem: FrontmatterProblem }

const commonPrefix = (a: string, b: string): number => {
  const limit = Math.min(a.length, b.length)
  const index = Array.from({ length: limit }).findIndex(
    (_, position) => a[position] !== b[position],
  )
  return index === -1 ? limit : index
}

const commonSuffix = (a: string, b: string, limit: number): number => {
  const room = Math.min(a.length, b.length, limit)
  const index = Array.from({ length: room }).findIndex(
    (_, position) => a[a.length - 1 - position] !== b[b.length - 1 - position],
  )
  return index === -1 ? room : index
}

export const changeBetween = (
  before: string,
  after: string,
): TextChange | null => {
  if (before === after) return null
  const prefix = commonPrefix(before, after)
  const suffix = commonSuffix(
    before,
    after,
    Math.min(before.length, after.length) - prefix,
  )
  return {
    from: prefix,
    to: before.length - suffix,
    insert: after.slice(prefix, after.length - suffix),
  }
}

export const applyChange = (
  text: string,
  { from, to, insert }: TextChange,
): string => text.slice(0, from) + insert + text.slice(to)

export const planFieldEdit = (
  text: string,
  values: SkillFieldValues,
): FieldEditPlan => {
  const edit = setSkillFields(text, values)
  if (!edit.ok) return { kind: 'refused', problem: edit.problem }
  const change = changeBetween(text, edit.text)
  return change === null ? { kind: 'unchanged' } : { kind: 'change', change }
}
