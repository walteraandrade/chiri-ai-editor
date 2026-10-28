import { describe, expect, it } from 'vitest'
import {
  adaptiveDiff,
  BLOCK_LEVEL_THRESHOLD,
  type DiffHunk,
} from './adaptive-diff'

const originalOf = (hunks: readonly DiffHunk[]): string =>
  hunks
    .filter((hunk) => hunk.type !== 'inserted')
    .map((hunk) => hunk.text)
    .join('')

const replacementOf = (hunks: readonly DiffHunk[]): string =>
  hunks
    .filter((hunk) => hunk.type !== 'deleted')
    .map((hunk) => hunk.text)
    .join('')

const words = (count: number, prefix: string): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ')

const withChangedWords = (total: number, changed: number) => ({
  original: `${words(total - changed, 'keep')} ${words(changed, 'old')}`,
  replacement: `${words(total - changed, 'keep')} ${words(changed, 'new')}`,
})

describe('adaptiveDiff', () => {
  it('exposes the threshold as a named constant', () => {
    expect(BLOCK_LEVEL_THRESHOLD).toBe(0.4)
  })

  it('returns a single equal hunk for identical text', () => {
    const result = adaptiveDiff('Same text.', 'Same text.')
    expect(result.mode).toBe('word')
    expect(result.changedShare).toBe(0)
    expect(result.hunks).toEqual([
      { type: 'equal', text: 'Same text.', from: 0, to: 10 },
    ])
  })

  it('marks a replaced word as deleted then inserted, with original offsets', () => {
    const original =
      'Once the canary looks healthy, you will recieve a prompt to promote it.'
    const replacement =
      'Once the canary looks healthy, you will receive a prompt to promote it.'
    const result = adaptiveDiff(original, replacement)

    expect(result.mode).toBe('word')
    const deleted = result.hunks.find((hunk) => hunk.type === 'deleted')
    const inserted = result.hunks.find((hunk) => hunk.type === 'inserted')
    expect(deleted).toMatchObject({ text: 'recieve' })
    expect(inserted).toMatchObject({ text: 'receive' })
    if (deleted?.type !== 'deleted' || inserted?.type !== 'inserted') {
      throw new Error('expected a deleted and an inserted hunk')
    }
    expect(original.slice(deleted.from, deleted.to)).toBe('recieve')
    expect(inserted.at).toBe(deleted.to)
    expect(originalOf(result.hunks)).toBe(original)
    expect(replacementOf(result.hunks)).toBe(replacement)
  })

  it('reports a pure insertion with no deleted hunk', () => {
    const result = adaptiveDiff(
      'The quick brown fox jumps over the dog',
      'The quick brown fox jumps over the lazy dog',
    )
    expect(result.mode).toBe('word')
    expect(result.hunks.some((hunk) => hunk.type === 'deleted')).toBe(false)
    expect(result.hunks.filter((hunk) => hunk.type === 'inserted')).toEqual([
      { type: 'inserted', text: 'lazy ', at: 35 },
    ])
  })

  it('reports a pure deletion with no inserted hunk', () => {
    const result = adaptiveDiff(
      'The quick brown fox jumps over the lazy dog today',
      'The quick brown fox jumps over the lazy dog',
    )
    expect(result.mode).toBe('word')
    expect(result.hunks.some((hunk) => hunk.type === 'inserted')).toBe(false)
    expect(result.hunks.filter((hunk) => hunk.type === 'deleted')).toEqual([
      { type: 'deleted', text: ' today', from: 43, to: 49 },
    ])
  })

  it('keeps hunks reversible in both directions', () => {
    const original = 'We deploy on weekdays, and the team reviews every change.'
    const replacement =
      'We deploy on any weekday, and reviewers check every change.'
    const result = adaptiveDiff(original, replacement)
    expect(originalOf(result.hunks)).toBe(original)
    expect(replacementOf(result.hunks)).toBe(replacement)
  })

  it('merges changes separated only by whitespace into one deleted and one inserted hunk', () => {
    const original = `${words(20, 'keep')} foo bar ${words(20, 'tail')}`
    const replacement = `${words(20, 'keep')} alpha beta ${words(20, 'tail')}`
    const result = adaptiveDiff(original, replacement)

    expect(result.mode).toBe('word')
    expect(result.hunks.filter((hunk) => hunk.type === 'deleted')).toHaveLength(
      1,
    )
    expect(
      result.hunks.filter((hunk) => hunk.type === 'inserted'),
    ).toHaveLength(1)
    expect(result.hunks.find((hunk) => hunk.type === 'deleted')?.text).toBe(
      'foo bar',
    )
    expect(result.hunks.find((hunk) => hunk.type === 'inserted')?.text).toBe(
      'alpha beta',
    )
  })

  it('always puts the deleted hunk before the inserted hunk of a change', () => {
    const result = adaptiveDiff(
      `${words(20, 'keep')} old ${words(20, 'tail')}`,
      `${words(20, 'keep')} new ${words(20, 'tail')}`,
    )
    const types = result.hunks.map((hunk) => hunk.type)
    expect(types).toEqual(['equal', 'deleted', 'inserted', 'equal'])
  })

  describe('threshold', () => {
    it('stays word-level when the changed share is below the threshold', () => {
      const { original, replacement } = withChangedWords(10, 3)
      const result = adaptiveDiff(original, replacement)
      expect(result.changedShare).toBeCloseTo(0.3)
      expect(result.mode).toBe('word')
    })

    it('stays word-level when the changed share equals the threshold', () => {
      const { original, replacement } = withChangedWords(10, 4)
      const result = adaptiveDiff(original, replacement)
      expect(result.changedShare).toBeCloseTo(BLOCK_LEVEL_THRESHOLD)
      expect(result.mode).toBe('word')
    })

    it('switches to block-level when the changed share exceeds the threshold', () => {
      const { original, replacement } = withChangedWords(10, 5)
      const result = adaptiveDiff(original, replacement)
      expect(result.changedShare).toBeCloseTo(0.5)
      expect(result.mode).toBe('block')
    })

    it('strikes the whole original and inserts the whole replacement in block mode', () => {
      const original = 'one two three four five'
      const replacement = 'alpha beta gamma delta epsilon'
      const result = adaptiveDiff(original, replacement)
      expect(result.mode).toBe('block')
      expect(result.changedShare).toBe(1)
      expect(result.hunks).toEqual([
        { type: 'deleted', text: original, from: 0, to: original.length },
        { type: 'inserted', text: replacement, at: original.length },
      ])
    })

    it('counts a heavy cut as a large change', () => {
      const original = words(20, 'w')
      const replacement = words(4, 'w')
      const result = adaptiveDiff(original, replacement)
      expect(result.changedShare).toBeCloseTo(16 / 24)
      expect(result.mode).toBe('block')
    })
  })

  describe('whitespace and Markdown', () => {
    it('keeps list markers equal when only one item changes', () => {
      const original =
        '- Tests are passing\n- Get a review\n- Write a rollback plan\n- Avoid handover'
      const replacement =
        '- Tests are passing\n- A second engineer reviews\n- Write a rollback plan\n- Avoid handover'
      const result = adaptiveDiff(original, replacement)

      expect(result.mode).toBe('word')
      expect(originalOf(result.hunks)).toBe(original)
      expect(replacementOf(result.hunks)).toBe(replacement)
      const deleted = result.hunks.filter((hunk) => hunk.type === 'deleted')
      expect(deleted.map((hunk) => hunk.text.trim())).toEqual(['Get a review'])
    })

    it('treats emphasis markers as part of the word', () => {
      const original = `${words(15, 'keep')} **bold** ${words(15, 'tail')}`
      const replacement = `${words(15, 'keep')} __bold__ ${words(15, 'tail')}`
      const result = adaptiveDiff(original, replacement)

      expect(result.mode).toBe('word')
      expect(result.hunks.find((hunk) => hunk.type === 'deleted')?.text).toBe(
        '**bold**',
      )
      expect(result.hunks.find((hunk) => hunk.type === 'inserted')?.text).toBe(
        '__bold__',
      )
    })

    it('reports a removed trailing newline without counting it as a word', () => {
      const result = adaptiveDiff('Same text.\n', 'Same text.')
      expect(result.mode).toBe('word')
      expect(result.changedShare).toBe(0)
      expect(result.hunks).toEqual([
        { type: 'equal', text: 'Same text.', from: 0, to: 10 },
        { type: 'deleted', text: '\n', from: 10, to: 11 },
      ])
    })

    it('reports a changed amount of whitespace as an actual change', () => {
      const result = adaptiveDiff('one  two', 'one two')
      expect(originalOf(result.hunks)).toBe('one  two')
      expect(replacementOf(result.hunks)).toBe('one two')
      expect(result.hunks.some((hunk) => hunk.type !== 'equal')).toBe(true)
    })

    it('handles an empty replacement and an empty original', () => {
      expect(adaptiveDiff('', '').hunks).toEqual([])
      expect(adaptiveDiff('', '').changedShare).toBe(0)
      const added = adaptiveDiff('', 'new text')
      expect(added.hunks).toEqual([
        { type: 'inserted', text: 'new text', at: 0 },
      ])
      const removed = adaptiveDiff('old text', '')
      expect(removed.hunks).toEqual([
        { type: 'deleted', text: 'old text', from: 0, to: 8 },
      ])
    })
  })
})
