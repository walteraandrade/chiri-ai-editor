import { setSkillFields } from './frontmatter-fields'

export const TEMPLATE_DESCRIPTION =
  'Describe what this skill does and when an agent should use it.'

const titleOf = (name: string): string => {
  const words = name.replaceAll('-', ' ')
  const [first = '', ...rest] = Array.from(words)
  return `${first.toLocaleUpperCase()}${rest.join('')}`
}

const bodyOf = (name: string): string =>
  [
    `# ${titleOf(name)}`,
    '',
    'Say in a sentence or two what this skill is for.',
    '',
    '## Instructions',
    '',
    '1. Describe the first step.',
    '2. Describe the next step.',
    '',
    '## Examples',
    '',
    'Show an input and the output the agent should produce.',
    '',
    '## Edge cases',
    '',
    'List the cases that need care, and what to do in each.',
    '',
  ].join('\n')

export const skillTemplate = (name: string): string => {
  const trimmed = name.trim()
  const edit = setSkillFields(bodyOf(trimmed), {
    name: trimmed,
    description: TEMPLATE_DESCRIPTION,
  })
  if (!edit.ok) throw new Error(edit.problem.message)
  return edit.text
}
