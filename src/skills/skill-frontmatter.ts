export const AGENT_SKILLS_SPEC_URL = 'https://agentskills.io/specification'

// Limits and rules for `name`, `description` and `compatibility`, as stated at AGENT_SKILLS_SPEC_URL.
export const NAME_MAX_LENGTH = 64
export const DESCRIPTION_MAX_LENGTH = 1024
export const COMPATIBILITY_MAX_LENGTH = 500

export type SkillField = 'name' | 'description'

export type CheckedField = SkillField | 'compatibility'

export type SkillRule =
  | `${SkillField}-${'missing' | 'not-text' | 'empty' | 'too-long'}`
  | `compatibility-${'not-text' | 'empty' | 'too-long'}`
  | 'name-not-lowercase'
  | 'name-invalid-characters'
  | 'name-edge-hyphen'
  | 'name-double-hyphen'
  | 'name-folder-mismatch'

export type SkillProblem = {
  readonly field: CheckedField
  readonly rule: SkillRule
  readonly message: string
}

const NOT_LETTER_DIGIT_OR_HYPHEN = /[^\p{L}\p{N}-]/u

const problem = (
  field: CheckedField,
  rule: SkillRule,
  message: string,
): SkillProblem => ({ field, rule, message })

const characterCount = (text: string): number => Array.from(text).length

const failed = (
  checks: readonly (SkillProblem | false)[],
): readonly SkillProblem[] =>
  checks.filter((check): check is SkillProblem => check !== false)

const readText = (field: SkillField, value: unknown): string | SkillProblem =>
  value === undefined || value === null
    ? problem(field, `${field}-missing`, `${field} is required`)
    : typeof value !== 'string'
      ? problem(field, `${field}-not-text`, `${field} must be text`)
      : value.trim() === ''
        ? problem(field, `${field}-empty`, `${field} must not be empty`)
        : value

const tooLong = (field: CheckedField, length: number, limit: number) =>
  problem(
    field,
    `${field}-too-long`,
    `${field} has ${length} characters; the limit is ${limit}`,
  )

const nameProblems = (
  name: string,
  folderName: string | undefined,
): readonly SkillProblem[] => {
  const normalized = name.trim().normalize('NFKC')
  const length = characterCount(normalized)
  return failed([
    length > NAME_MAX_LENGTH && tooLong('name', length, NAME_MAX_LENGTH),
    normalized !== normalized.toLowerCase() &&
      problem('name', 'name-not-lowercase', 'name must be lowercase'),
    (normalized.startsWith('-') || normalized.endsWith('-')) &&
      problem(
        'name',
        'name-edge-hyphen',
        'name must not start or end with a hyphen',
      ),
    normalized.includes('--') &&
      problem(
        'name',
        'name-double-hyphen',
        'name must not contain consecutive hyphens',
      ),
    NOT_LETTER_DIGIT_OR_HYPHEN.test(normalized) &&
      problem(
        'name',
        'name-invalid-characters',
        'name may only contain letters, digits and hyphens',
      ),
    folderName !== undefined &&
      folderName.normalize('NFKC') !== normalized &&
      problem(
        'name',
        'name-folder-mismatch',
        `name must match its folder name, "${folderName}"`,
      ),
  ])
}

const descriptionProblems = (description: string): readonly SkillProblem[] => {
  const length = characterCount(description)
  return failed([
    length > DESCRIPTION_MAX_LENGTH &&
      tooLong('description', length, DESCRIPTION_MAX_LENGTH),
  ])
}

const compatibilityProblems = (value: unknown): readonly SkillProblem[] => {
  if (value === undefined) return []
  if (value === null)
    return [
      problem(
        'compatibility',
        'compatibility-empty',
        'compatibility must not be empty',
      ),
    ]
  if (typeof value !== 'string')
    return [
      problem(
        'compatibility',
        'compatibility-not-text',
        'compatibility must be text',
      ),
    ]
  const length = characterCount(value)
  return value.trim() === ''
    ? [
        problem(
          'compatibility',
          'compatibility-empty',
          'compatibility must not be empty',
        ),
      ]
    : failed([
        length > COMPATIBILITY_MAX_LENGTH &&
          tooLong('compatibility', length, COMPATIBILITY_MAX_LENGTH),
      ])
}

export const checkSkillName = (
  name: string,
  folderName?: string,
): readonly SkillProblem[] => {
  const checked = readText('name', name)
  return typeof checked === 'string'
    ? nameProblems(checked, folderName)
    : [checked]
}

export const checkSkillFrontmatter = (
  fields: Readonly<Record<string, unknown>>,
  folderName?: string,
): readonly SkillProblem[] => {
  const name = readText('name', fields.name)
  const description = readText('description', fields.description)
  return [
    ...(typeof name === 'string' ? nameProblems(name, folderName) : [name]),
    ...(typeof description === 'string'
      ? descriptionProblems(description)
      : [description]),
    ...compatibilityProblems(fields.compatibility),
  ]
}
