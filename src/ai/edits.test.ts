import { describe, expect, it } from 'vitest'
import { extractBlocks } from '../blocks/extract-blocks'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import {
  checkSuggestion,
  initialReviewState,
  MAX_REVIEW_EDITS,
  validateReviewEdit,
  validateReviewEdits,
} from './edits'

const DOC = [
  '# Title',
  '',
  'One.',
  '',
  'Two.',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  'Three.',
  '',
  'Four.',
  '',
  'Five.',
  '',
  'Six.',
  '',
  'Seven.',
  '',
  'Eight.',
  '',
].join('\n')

const blocks = extractBlocks(DOC)
const idOf = (text: string) => {
  const block = blocks.find((candidate) => candidate.text === text)
  if (!block) throw new Error(`no block ${text}`)
  return block.id
}
const edit = (text: string, replacement = `${text} edited`) => ({
  blockId: idOf(text),
  replacement,
  rationale: 'Because.',
})

describe('validateReviewEdits', () => {
  it('keeps an edit that changes a known Block', () => {
    const { validated, dropped } = validateReviewEdits([edit('One.')], blocks)
    expect(dropped).toEqual([])
    expect(validated).toHaveLength(1)
    expect(validated[0]).toMatchObject({
      blockId: idOf('One.'),
      replacement: 'One. edited',
    })
    expect(validated[0]?.block.text).toBe('One.')
  })

  it('drops an edit with an unknown blockId', () => {
    const { validated, dropped } = validateReviewEdits(
      [{ blockId: 'p99', replacement: 'x', rationale: 'y' }],
      blocks,
    )
    expect(validated).toEqual([])
    expect(dropped.map(({ reason }) => reason)).toEqual(['unknown-block'])
  })

  it('drops an edit whose replacement equals the original', () => {
    const { dropped } = validateReviewEdits([edit('One.', 'One.')], blocks)
    expect(dropped.map(({ reason }) => reason)).toEqual(['unchanged'])
  })

  it('compares the original and the replacement trimmed', () => {
    const { dropped } = validateReviewEdits([edit('One.', '  One.\n')], blocks)
    expect(dropped.map(({ reason }) => reason)).toEqual(['unchanged'])
  })

  it('drops an edit with an empty replacement', () => {
    const { dropped } = validateReviewEdits([edit('One.', '  ')], blocks)
    expect(dropped.map(({ reason }) => reason)).toEqual(['empty'])
  })

  it('never edits code blocks', () => {
    const code = blocks.find((block) => block.kind === 'code')
    const { validated, dropped } = validateReviewEdits(
      [{ blockId: code?.id ?? '', replacement: 'changed', rationale: 'x' }],
      blocks,
    )
    expect(validated).toEqual([])
    expect(dropped.map(({ reason }) => reason)).toEqual(['code-block'])
  })

  it('skips occupied Blocks', () => {
    const occupied = new Set([idOf('One.')])
    const { validated, dropped } = validateReviewEdits(
      [edit('One.'), edit('Two.')],
      blocks,
      occupied,
    )
    expect(validated.map((entry) => entry.blockId)).toEqual([idOf('Two.')])
    expect(dropped.map(({ reason }) => reason)).toEqual(['occupied'])
  })

  it('keeps only the first edit for a Block', () => {
    const { validated, dropped } = validateReviewEdits(
      [edit('One.', 'First'), edit('One.', 'Second')],
      blocks,
    )
    expect(validated.map((entry) => entry.replacement)).toEqual(['First'])
    expect(dropped.map(({ reason }) => reason)).toEqual(['duplicate-block'])
  })

  it('caps the validated edits at 6, keeping the first ones', () => {
    const texts = [
      'One.',
      'Two.',
      'Three.',
      'Four.',
      'Five.',
      'Six.',
      'Seven.',
      'Eight.',
    ]
    const { validated, dropped } = validateReviewEdits(
      texts.map((text) => edit(text)),
      blocks,
    )
    expect(MAX_REVIEW_EDITS).toBe(6)
    expect(validated.map((entry) => entry.block.text)).toEqual(
      texts.slice(0, 6),
    )
    expect(dropped.map(({ reason }) => reason)).toEqual([
      'over-limit',
      'over-limit',
    ])
  })

  it('does not count dropped edits towards the cap', () => {
    const edits = [
      { blockId: 'p99', replacement: 'x', rationale: 'y' },
      edit('One.', 'One.'),
      edit('Two.'),
    ]
    expect(validateReviewEdits(edits, blocks).validated).toHaveLength(1)
  })

  it('handles an empty edit list', () => {
    expect(validateReviewEdits([], blocks)).toEqual({
      validated: [],
      dropped: [],
    })
  })

  it('validates against the sample Document', () => {
    const sample = extractBlocks(SAMPLE_DOCUMENT)
    const { validated } = validateReviewEdits(
      [
        { blockId: 'p12', replacement: 'Fixed', rationale: 'Typo.' },
        { blockId: 'p11', replacement: 'Nope', rationale: 'Code.' },
      ],
      sample,
    )
    expect(validated.map((entry) => entry.blockId)).toEqual(['p12'])
  })
})

describe('validateReviewEdit', () => {
  const context = { blocks, occupied: new Set<string>() }

  it('threads state through successive edits without mutating it', () => {
    const first = validateReviewEdit(context, initialReviewState, edit('One.'))
    expect(first.outcome.type).toBe('validated')
    expect(initialReviewState.validated).toBe(0)
    const second = validateReviewEdit(
      context,
      first.state,
      edit('One.', 'Again'),
    )
    expect(second.outcome).toMatchObject({
      type: 'dropped',
      reason: 'duplicate-block',
    })
    expect(first.state.validated).toBe(1)
  })
})

describe('checkSuggestion', () => {
  it('passes a changed replacement', () => {
    expect(
      checkSuggestion('Hello world', {
        replacement: 'Hi',
        rationale: 'Short.',
      }),
    ).toEqual({
      type: 'valid',
      suggestion: { replacement: 'Hi', rationale: 'Short.', unchanged: false },
    })
  })

  it('flags a replacement equal to the original as unchanged', () => {
    expect(
      checkSuggestion('Hello world', {
        replacement: ' Hello world\n',
        rationale: 'Fine.',
      }),
    ).toMatchObject({ type: 'valid', suggestion: { unchanged: true } })
  })

  it('rejects an empty replacement', () => {
    expect(
      checkSuggestion('Hello world', { replacement: '  ', rationale: 'x' }),
    ).toEqual({ type: 'invalid', reason: 'empty' })
  })
})
