import type { TargetRequest } from '../ai/client'

export const DESCRIPTION_INSTRUCTION =
  'Rewrite this skill description so an agent can tell when to load the skill: say what it does and when to use it, with the words a user would say. Keep it on one line of plain text, with no quotes, no Markdown and no label.'

const FENCE = /^```[a-z]*\s*\n?|\n?```\s*$/g
const LABEL = /^description:\s*/i
const WRAPPING_QUOTES = /^(["'])(.*)\1$/s

export const normalizeDescription = (text: string): string => {
  const unfenced = text.replace(FENCE, '').trim()
  const unlabeled = unfenced.replace(LABEL, '')
  const unquoted = unlabeled.replace(WRAPPING_QUOTES, '$2')
  return unquoted.replace(/\s+/g, ' ').trim()
}

export const descriptionRequest = (
  name: string,
  description: string,
): Pick<TargetRequest, 'target' | 'neighbors' | 'instruction'> => ({
  target: {
    source: 'block',
    from: 0,
    to: description.length,
    text: description,
    blocks: [],
  },
  neighbors: { title: `Skill ${name}`, before: [], after: [] },
  instruction: DESCRIPTION_INSTRUCTION,
})
