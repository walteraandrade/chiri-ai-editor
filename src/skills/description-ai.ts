import { findFrontmatter } from '../blocks/frontmatter'
import { DESCRIPTION_MAX_LENGTH } from './skill-frontmatter'

export const SKILL_BODY_MAX_CHARS = 20_000

const FENCE = /^```[a-z]*\s*\n?|\n?```\s*$/g
const LABEL = /^description:\s*/i
const WRAPPING_QUOTES = /^(["'])(.*)\1$/s

export const normalizeDescription = (text: string): string => {
  const unfenced = text.replace(FENCE, '').trim()
  const unlabeled = unfenced.replace(LABEL, '')
  const unquoted = unlabeled.replace(WRAPPING_QUOTES, '$2')
  return unquoted.replace(/\s+/g, ' ').trim()
}

const CUT_NOTE = '\n[The body is cut here.]'

export const skillBody = (text: string): string => {
  const body = text.slice(findFrontmatter(text)?.to ?? 0).trim()
  return body.length > SKILL_BODY_MAX_CHARS
    ? `${body.slice(0, SKILL_BODY_MAX_CHARS)}${CUT_NOTE}`
    : body
}

export type DescriptionOutcome =
  | { readonly kind: 'ready'; readonly description: string }
  | { readonly kind: 'failed'; readonly message: string }

export const descriptionOutcome = (
  replacement: string,
  current: string,
): DescriptionOutcome => {
  const next = normalizeDescription(replacement)
  return next === '' || next === current.trim()
    ? { kind: 'failed', message: 'No better description came back.' }
    : next.length > DESCRIPTION_MAX_LENGTH
      ? {
          kind: 'failed',
          message: `The new description came back over ${DESCRIPTION_MAX_LENGTH} characters.`,
        }
      : { kind: 'ready', description: next }
}

export const descriptionSource = (name: string, description: string): string =>
  JSON.stringify([name, description])
