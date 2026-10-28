import { describe, expect, it } from 'vitest'
import { extractBlocks } from '../blocks/extract-blocks'
import { getNeighbors, resolveTarget } from '../blocks/target'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import {
  buildRefinePrompt,
  buildReviewPrompt,
  buildTargetPrompt,
  SYSTEM_PROMPT,
} from './prompts'
import { QUICK_ACTIONS } from './quick-actions'

const DOC = [
  '# Guide',
  '',
  '## Setup',
  '',
  'Alpha.',
  '',
  'Beta beta beta.',
  '',
  'Gamma.',
  '',
  'Delta.',
  '',
  'Epsilon.',
  '',
].join('\n')

const blocks = extractBlocks(DOC)

const targetAt = (needle: string, length = 0) => {
  const from = DOC.indexOf(needle)
  const target = resolveTarget(blocks, DOC, { from, to: from + length })
  if (!target) throw new Error('no target')
  return { target, neighbors: getNeighbors(blocks, target) }
}

describe('SYSTEM_PROMPT', () => {
  it('states the five fixed rules', () => {
    expect(SYSTEM_PROMPT).toMatch(/language of the Target/i)
    expect(SYSTEM_PROMPT).toMatch(/only what the Instruction needs/i)
    expect(SYSTEM_PROMPT).toMatch(/do not invent facts, numbers or names/i)
    expect(SYSTEM_PROMPT).toMatch(/preserve markdown syntax/i)
    expect(SYSTEM_PROMPT).toMatch(
      /one short sentence.*language of the Document/is,
    )
  })

  it('does not push the model away from a language', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/not the language/i)
  })

  it('treats Document text as content, not instructions', () => {
    expect(SYSTEM_PROMPT).toMatch(/not instructions/i)
  })
})

describe('QUICK_ACTIONS', () => {
  it('exports the four Quick actions with an Instruction each', () => {
    expect(QUICK_ACTIONS.map((action) => action.label)).toEqual([
      'Shorter',
      'Clearer',
      'More formal',
      'Fix grammar',
    ])
    for (const action of QUICK_ACTIONS) {
      expect(action.instruction.length).toBeGreaterThan(10)
    }
  })

  it('has unique ids', () => {
    const ids = QUICK_ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildTargetPrompt', () => {
  it('includes the Target text and the Instruction', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildTargetPrompt({
      target,
      neighbors,
      instruction: 'Make it shorter.',
    })
    expect(prompt).toContain('<target>\nGamma.\n</target>')
    expect(prompt).toContain('Make it shorter.')
  })

  it('includes the title and the section heading', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildTargetPrompt({
      target,
      neighbors,
      instruction: 'x',
    })
    expect(prompt).toContain('Document title: Guide')
    expect(prompt).toContain('Current section: Setup')
  })

  it('includes the Neighbors in Document order around the Target', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildTargetPrompt({
      target,
      neighbors,
      instruction: 'x',
    })
    const order = [
      'Setup',
      'Alpha.',
      'Beta beta beta.',
      'Gamma.',
      'Delta.',
      'Epsilon.',
    ]
    const positions = order.map((text) => prompt.indexOf(text))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(prompt).toContain('<context-before>')
    expect(prompt).toContain('<context-after>')
  })

  it('omits empty context sections and missing headings', () => {
    const doc = 'Only paragraph.\n'
    const docBlocks = extractBlocks(doc)
    const target = resolveTarget(docBlocks, doc, { from: 0, to: 0 })
    if (!target) throw new Error('no target')
    const { prompt } = buildTargetPrompt({
      target,
      neighbors: getNeighbors(docBlocks, target),
      instruction: 'x',
    })
    expect(prompt).not.toContain('<context-before>')
    expect(prompt).not.toContain('<context-after>')
    expect(prompt).not.toContain('Document title')
    expect(prompt).not.toContain('Current section')
  })

  it('shows the enclosing Block when the selection is only part of it', () => {
    const { target, neighbors } = targetAt('beta', 4)
    const { prompt } = buildTargetPrompt({
      target,
      neighbors,
      instruction: 'x',
    })
    expect(prompt).toContain('<target>\nbeta\n</target>')
    expect(prompt).toContain(
      '<enclosing-text>\nBeta beta beta.\n</enclosing-text>',
    )
  })

  it('does not repeat the Block when the Target is the whole Block', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildTargetPrompt({
      target,
      neighbors,
      instruction: 'x',
    })
    expect(prompt).not.toContain('<enclosing-text>')
  })

  it('ends by asking for the Document language', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildTargetPrompt({
      target,
      neighbors,
      instruction: 'x',
    })
    expect(prompt).toMatch(
      /replacement in the language of the Target and the rationale in the language of the Document\.$/,
    )
  })

  it('returns the system prompt as instructions', () => {
    const { target, neighbors } = targetAt('Gamma.')
    expect(
      buildTargetPrompt({ target, neighbors, instruction: 'x' }).instructions,
    ).toBe(SYSTEM_PROMPT)
  })
})

describe('buildRefinePrompt', () => {
  const build = () => {
    const { target, neighbors } = targetAt('Gamma.')
    return buildRefinePrompt({
      target,
      neighbors,
      history: ['Make it shorter.', 'More formal.'],
      latestReplacement: 'Gamma, briefly.',
      instruction: 'Add a warmer tone.',
    })
  }

  it('includes the original text, the latest Replacement and the new Instruction', () => {
    const { prompt } = build()
    expect(prompt).toContain('<original>\nGamma.\n</original>')
    expect(prompt).toContain(
      '<latest-replacement>\nGamma, briefly.\n</latest-replacement>',
    )
    expect(prompt).toContain('New instruction: Add a warmer tone.')
  })

  it('lists the previous Instructions oldest first', () => {
    const { prompt } = build()
    expect(prompt).toContain('1. Make it shorter.\n2. More formal.')
  })

  it('asks for the Document language', () => {
    expect(build().prompt).toMatch(
      /replacement in the language of the Target and the rationale in the language of the Document\.$/,
    )
  })

  it('keeps the Neighbors', () => {
    const { prompt } = build()
    expect(prompt).toContain('Alpha.')
    expect(prompt).toContain('Delta.')
  })

  it('puts the original, the history, the latest Replacement and the new Instruction in that order', () => {
    const { prompt } = build()
    const positions = [
      '<original>',
      'Previous instructions, oldest first',
      '<latest-replacement>',
      'New instruction:',
    ].map((marker) => prompt.indexOf(marker))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('numbers a long history from the first Instruction', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildRefinePrompt({
      target,
      neighbors,
      history: ['Make it shorter.', 'Now more formal.', 'Drop the adjectives.'],
      latestReplacement: 'G.',
      instruction: 'Add a warmer tone.',
    })
    expect(prompt).toContain(
      '1. Make it shorter.\n2. Now more formal.\n3. Drop the adjectives.',
    )
  })

  it('sends the title and the current section with the Neighbors', () => {
    const { prompt } = build()
    expect(prompt).toContain('Document title: Guide')
    expect(prompt).toContain('Current section: Setup')
    expect(prompt.indexOf('Alpha.')).toBeLessThan(prompt.indexOf('<original>'))
    expect(prompt.indexOf('Delta.')).toBeGreaterThan(
      prompt.indexOf('</original>'),
    )
  })

  it('shows the enclosing Block when the original is only part of it', () => {
    const { target, neighbors } = targetAt('beta', 4)
    const { prompt } = buildRefinePrompt({
      target,
      neighbors,
      history: ['Make it shorter.'],
      latestReplacement: 'b',
      instruction: 'x',
    })
    expect(prompt).toContain('<original>\nbeta\n</original>')
    expect(prompt).toContain(
      '<enclosing-text>\nBeta beta beta.\n</enclosing-text>',
    )
  })

  it('keeps the effect of the previous Instructions unless contradicted', () => {
    expect(build().prompt).toMatch(
      /keep the effect of the previous instructions, unless the new instruction contradicts them/,
    )
  })

  it('returns the system prompt with the five fixed rules as instructions', () => {
    const { instructions } = build()
    expect(instructions).toBe(SYSTEM_PROMPT)
    expect(instructions).toMatch(/language of the Target/i)
    expect(instructions).toMatch(/only what the Instruction needs/i)
    expect(instructions).toMatch(/do not invent facts, numbers or names/i)
    expect(instructions).toMatch(/preserve markdown syntax/i)
    expect(instructions).toMatch(
      /one short sentence.*language of the Document/is,
    )
  })

  it('works with no previous Instructions', () => {
    const { target, neighbors } = targetAt('Gamma.')
    const { prompt } = buildRefinePrompt({
      target,
      neighbors,
      history: [],
      latestReplacement: 'G.',
      instruction: 'x',
    })
    expect(prompt).not.toContain('Previous instructions')
  })
})

describe('buildReviewPrompt', () => {
  it('numbers every Block in Document order', () => {
    const { prompt } = buildReviewPrompt({ blocks })
    const ids = [...prompt.matchAll(/<block id="(p\d+)"/g)].map((m) => m[1])
    expect(ids).toEqual(blocks.map((block) => block.id))
  })

  it('wraps each Block text in its tag', () => {
    const { prompt } = buildReviewPrompt({ blocks })
    expect(prompt).toContain(
      '<block id="p5" kind="paragraph">\nGamma.\n</block>',
    )
  })

  it('labels headings with their level', () => {
    const { prompt } = buildReviewPrompt({ blocks })
    expect(prompt).toContain('<block id="p1" kind="heading" level="1">')
  })

  it('marks code blocks as read-only', () => {
    const { prompt } = buildReviewPrompt({
      blocks: extractBlocks(SAMPLE_DOCUMENT),
    })
    expect(prompt).toMatch(/<block id="p11" kind="code"[^>]*>/)
  })

  it('reviews clarity, concision, grammar and tone when there is no Focus', () => {
    const { prompt } = buildReviewPrompt({ blocks })
    for (const word of [
      'clarity',
      'concision',
      'grammar',
      'tone consistency',
    ]) {
      expect(prompt).toContain(word)
    }
  })

  it('uses the Focus instead of the default criteria when given', () => {
    const { prompt } = buildReviewPrompt({ blocks, focus: 'focus on tone' })
    expect(prompt).toContain('Focus: focus on tone')
    expect(prompt).not.toContain('concision')
  })

  it('ignores a blank Focus', () => {
    const { prompt } = buildReviewPrompt({ blocks, focus: '   ' })
    expect(prompt).not.toContain('Focus:')
    expect(prompt).toContain('concision')
  })

  it('asks for the Document language', () => {
    expect(buildReviewPrompt({ blocks }).prompt).toMatch(
      /<\/block>\n\nWrite each replacement in the language of its Block and each rationale in the language of the Document\.$/,
    )
  })

  it('caps the edits and forbids editing code', () => {
    const { prompt } = buildReviewPrompt({ blocks })
    expect(prompt).toMatch(/at most 6 edits/i)
    expect(prompt).toMatch(/most important first/i)
    expect(prompt).toMatch(/one edit per block/i)
    expect(prompt).toMatch(/never edit code blocks/i)
  })

  it('returns the system prompt as instructions', () => {
    expect(buildReviewPrompt({ blocks }).instructions).toBe(SYSTEM_PROMPT)
  })
})
