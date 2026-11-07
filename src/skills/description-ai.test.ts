import { describe, expect, it } from 'vitest'
import {
  descriptionOutcome,
  descriptionSource,
  normalizeDescription,
  SKILL_BODY_MAX_CHARS,
  skillBody,
} from './description-ai'

describe('normalizeDescription', () => {
  it('turns lines into one line', () => {
    expect(normalizeDescription('Use when the user\nasks about  PDFs.\n')).toBe(
      'Use when the user asks about PDFs.',
    )
  })

  it('drops quotes, a code fence and a leading "description:" label', () => {
    expect(normalizeDescription('"Use when X."')).toBe('Use when X.')
    expect(normalizeDescription('description: Use when X.')).toBe('Use when X.')
    expect(normalizeDescription('```\nUse when X.\n```')).toBe('Use when X.')
  })

  it('leaves an ordinary description alone', () => {
    expect(normalizeDescription('Use when X: do Y, then Z.')).toBe(
      'Use when X: do Y, then Z.',
    )
  })

  it('returns empty text for nothing', () => {
    expect(normalizeDescription('  \n ')).toBe('')
  })
})

describe('skillBody', () => {
  it('returns the text after the frontmatter, trimmed', () => {
    expect(
      skillBody('---\nname: a\ndescription: b\n---\n\n# Title\n\nBody.\n'),
    ).toBe('# Title\n\nBody.')
  })

  it('returns the whole text when there is no frontmatter', () => {
    expect(skillBody('# Title\n')).toBe('# Title')
  })

  it('cuts a long body and says so', () => {
    const body = skillBody(`---\nname: a\n---\n${'x'.repeat(50_000)}`)
    expect(body).toBe(
      `${'x'.repeat(SKILL_BODY_MAX_CHARS)}\n[The body is cut here.]`,
    )
  })

  it('keeps a body of exactly the limit whole', () => {
    expect(skillBody('x'.repeat(SKILL_BODY_MAX_CHARS))).toBe(
      'x'.repeat(SKILL_BODY_MAX_CHARS),
    )
  })
})

describe('descriptionOutcome', () => {
  it('accepts a new description, normalized', () => {
    expect(descriptionOutcome('"Does X. Use when Y."', 'Does X.')).toEqual({
      kind: 'ready',
      description: 'Does X. Use when Y.',
    })
  })

  it('fails on nothing or on the same text', () => {
    const none = { kind: 'failed', message: 'No better description came back.' }
    expect(descriptionOutcome(' ', 'Does X.')).toEqual(none)
    expect(descriptionOutcome('Does X.', ' Does X. ')).toEqual(none)
  })

  it('fails when the answer only restates the current text', () => {
    expect(descriptionOutcome('description: "Does X."', 'Does X.').kind).toBe(
      'failed',
    )
  })

  it('accepts exactly 1024 characters', () => {
    expect(descriptionOutcome('x'.repeat(1024), 'Does X.').kind).toBe('ready')
  })

  it('fails on a description over the spec limit', () => {
    expect(descriptionOutcome('x'.repeat(1025), 'Does X.')).toEqual({
      kind: 'failed',
      message: 'The new description came back over 1024 characters.',
    })
  })
})

describe('descriptionSource', () => {
  it('differs when the skill or the description differs', () => {
    const base = descriptionSource('pdf-tools', 'Works with PDFs.')
    expect(descriptionSource('pdf-tools', 'Works with PDFs.')).toBe(base)
    expect(descriptionSource('other', 'Works with PDFs.')).not.toBe(base)
    expect(descriptionSource('pdf-tools', 'Works with docs.')).not.toBe(base)
    expect(descriptionSource('a', 'b\nc')).not.toBe(
      descriptionSource('a\nb', 'c'),
    )
  })
})
