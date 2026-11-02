import {
  type FrontmatterProblem,
  type FrontmatterProblemRule,
  readFrontmatter,
  setSkillFields,
} from './frontmatter-fields'
import { SKILL_FILE_NAME } from './scan-skills'
import {
  type CheckedField,
  checkSkillFrontmatter,
  type SkillProblem,
  type SkillRule,
} from './skill-frontmatter'

export type FrontmatterContext = {
  readonly fileName: string | null
  readonly folderName: string | undefined
}

export type PanelRule = SkillRule | FrontmatterProblemRule

export type PanelProblem = {
  readonly field: CheckedField | null
  readonly rule: PanelRule
  readonly message: string
}

export type FrontmatterReport =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'unreadable'
      readonly skill: boolean
      readonly problems: readonly PanelProblem[]
    }
  | {
      readonly kind: 'skill'
      readonly name: string
      readonly description: string
      readonly present: boolean
      readonly problems: readonly PanelProblem[]
    }

const NONE: FrontmatterReport = { kind: 'none' }

const SKILL_PROBLEMS: Readonly<
  Record<SkillRule, (problem: SkillProblem) => string>
> = {
  'name-missing': () =>
    'name is missing. It is required and must match the skill folder',
  'name-not-text': () =>
    'name must be text. Put it in quotes if it looks like a number or true / false',
  'name-empty': () => 'name is empty. It needs 1 to 64 characters',
  'name-too-long': ({ message }) => message,
  'name-not-lowercase': ({ message }) => message,
  'name-invalid-characters': ({ message }) => message,
  'name-edge-hyphen': ({ message }) => message,
  'name-double-hyphen': ({ message }) => message,
  'name-folder-mismatch': ({ message }) =>
    `${message}. Rename the folder or change the name`,
  'description-missing': () =>
    'description is missing. Agents read it to decide when to use the skill',
  'description-not-text': () =>
    'description must be text. Put it in quotes if it looks like a number or true / false',
  'description-empty': () =>
    'description is empty. Say what the skill does and when to use it',
  'description-too-long': ({ message }) => message,
  'compatibility-not-text': () => 'compatibility must be text',
  'compatibility-empty': () =>
    'compatibility is empty. Remove it or say what the skill needs',
  'compatibility-too-long': ({ message }) => message,
}

export const describeSkillProblem = (problem: SkillProblem): string =>
  SKILL_PROBLEMS[problem.rule](problem)

const FRONTMATTER_PROBLEMS: Readonly<
  Record<FrontmatterProblemRule, (problem: FrontmatterProblem) => string>
> = {
  'frontmatter-not-closed': () =>
    'The frontmatter is not closed. Add a --- line after the last key',
  'frontmatter-not-recognized': () =>
    'The --- block at the top is not key: value lines, so it is not read as frontmatter',
  'frontmatter-not-a-mapping': () => 'The frontmatter must be key: value lines',
  'yaml-syntax-error': ({ line, message }) =>
    line === undefined
      ? `YAML error: ${message}`
      : `YAML error on line ${line}: ${message}`,
}

export const describeFrontmatterProblem = (
  problem: FrontmatterProblem,
): string => FRONTMATTER_PROBLEMS[problem.rule](problem)

const ANNOUNCEMENTS: Readonly<Record<PanelRule, string>> = {
  'name-missing': 'name is missing',
  'name-not-text': 'name is not text',
  'name-empty': 'name is empty',
  'name-too-long': 'name is too long',
  'name-not-lowercase': 'name is not lowercase',
  'name-invalid-characters': 'name has invalid characters',
  'name-edge-hyphen': 'name starts or ends with a hyphen',
  'name-double-hyphen': 'name has consecutive hyphens',
  'name-folder-mismatch': 'name does not match its folder',
  'description-missing': 'description is missing',
  'description-not-text': 'description is not text',
  'description-empty': 'description is empty',
  'description-too-long': 'description is too long',
  'compatibility-not-text': 'compatibility is not text',
  'compatibility-empty': 'compatibility is empty',
  'compatibility-too-long': 'compatibility is too long',
  'frontmatter-not-closed': 'the frontmatter is not closed',
  'frontmatter-not-recognized': 'the frontmatter is not recognized',
  'frontmatter-not-a-mapping': 'the frontmatter is not key: value lines',
  'yaml-syntax-error': 'the frontmatter has a YAML error',
}

export const announceRule = (rule: PanelRule): string => ANNOUNCEMENTS[rule]

const unreadable = (
  skill: boolean,
  problem: FrontmatterProblem,
): FrontmatterReport => ({
  kind: 'unreadable',
  skill,
  problems: [
    {
      field: null,
      rule: problem.rule,
      message: describeFrontmatterProblem(problem),
    },
  ],
})

const shown = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
      ? String(value)
      : ''

export const inspectFrontmatter = (
  text: string,
  { fileName, folderName }: FrontmatterContext,
): FrontmatterReport => {
  const skill = fileName === SKILL_FILE_NAME
  const reading = readFrontmatter(text)
  if (reading.kind === 'invalid') return unreadable(skill, reading.problem)
  if (!skill) return NONE
  if (reading.kind === 'absent') {
    const edit = setSkillFields(text, {})
    if (!edit.ok) return unreadable(true, edit.problem)
  }
  const fields = reading.kind === 'present' ? reading.fields : {}
  return {
    kind: 'skill',
    name: shown(fields.name),
    description: shown(fields.description),
    present: reading.kind === 'present',
    problems: checkSkillFrontmatter(fields, folderName).map((problem) => ({
      field: problem.field,
      rule: problem.rule,
      message: describeSkillProblem(problem),
    })),
  }
}

const problemsIn = (report: FrontmatterReport): readonly PanelProblem[] =>
  report.kind === 'none' ? [] : report.problems

export const reportProblems = (report: FrontmatterReport): readonly string[] =>
  problemsIn(report).map(({ message }) => message)

export const problemsOfField = (
  report: FrontmatterReport,
  field: CheckedField,
): readonly PanelProblem[] =>
  problemsIn(report).filter((problem) => problem.field === field)

export const announceProblems = (report: FrontmatterReport): string => {
  if (report.kind === 'none') return ''
  return report.problems.length === 0
    ? 'No frontmatter problems'
    : `Frontmatter problems: ${report.problems
        .map(({ rule }) => announceRule(rule))
        .join('; ')}`
}

export const otherProblems = (
  report: FrontmatterReport,
): readonly PanelProblem[] =>
  problemsIn(report).filter(
    ({ field }) => field !== 'name' && field !== 'description',
  )

export const isSameReport = (
  a: FrontmatterReport,
  b: FrontmatterReport,
): boolean => JSON.stringify(a) === JSON.stringify(b)
