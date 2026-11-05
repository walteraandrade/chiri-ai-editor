import { describe, expect, it } from 'vitest'
import {
  DESCRIPTION_INSTRUCTION,
  descriptionRequest,
  normalizeDescription,
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

describe('descriptionRequest', () => {
  it('asks about the description as a single block, naming the skill', () => {
    const request = descriptionRequest('pdf-tools', 'Works with PDFs.')
    expect(request.target).toEqual({
      source: 'block',
      from: 0,
      to: 'Works with PDFs.'.length,
      text: 'Works with PDFs.',
      blocks: [],
    })
    expect(request.neighbors).toEqual({
      title: 'Skill pdf-tools',
      before: [],
      after: [],
    })
    expect(request.instruction).toBe(DESCRIPTION_INSTRUCTION)
  })

  it('says the answer must be one line of plain text', () => {
    expect(DESCRIPTION_INSTRUCTION).toMatch(/one line/i)
    expect(DESCRIPTION_INSTRUCTION).toMatch(/when/i)
  })
})
