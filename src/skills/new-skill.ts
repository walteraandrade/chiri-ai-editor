import { announceRule } from './frontmatter-panel'
import type {
  CreateSkillRequest,
  CreateSkillResult,
  LibraryListing,
  LibraryRoot,
} from './library'
import { SKILL_FILE_NAME } from './scan-skills'
import { checkSkillName } from './skill-frontmatter'

export type NewSkillOutcome = CreateSkillResult | { readonly kind: 'cancelled' }

export type NewSkillDraft = {
  readonly problems: readonly string[]
  readonly announcement: string
  readonly ready: boolean
  readonly location: string | null
}

export const writableRoots = (roots: LibraryListing): LibraryListing =>
  roots.filter(({ readable }) => readable)

export const firstWritableRoot = (
  roots: LibraryListing,
): LibraryRoot | undefined => writableRoots(roots).at(0)

export const newSkillDraft = (
  name: string,
  root: LibraryRoot | undefined,
): NewSkillDraft => {
  const trimmed = name.trim()
  if (trimmed === '')
    return { problems: [], announcement: '', ready: false, location: null }
  const taken = root?.skills.some(({ folderName }) => folderName === trimmed)
  const rules = checkSkillName(trimmed)
  const problems = [
    ...rules.map(({ message }) => message),
    ...(taken && root !== undefined
      ? [`A skill folder named "${trimmed}" already exists in ${root.label}`]
      : []),
  ]
  const phrases = [
    ...rules.map(({ rule }) => announceRule(rule)),
    ...(taken ? ['a skill folder with this name already exists'] : []),
  ]
  return {
    problems,
    announcement:
      phrases.length === 0 ? '' : `Name problems: ${phrases.join('; ')}`,
    ready: problems.length === 0 && root !== undefined,
    location:
      root === undefined ? null : `${root.label}/${trimmed}/${SKILL_FILE_NAME}`,
  }
}

export const newSkillRequest = (
  name: string,
  root: LibraryRoot,
): CreateSkillRequest => ({ root: root.root, name: name.trim() })
