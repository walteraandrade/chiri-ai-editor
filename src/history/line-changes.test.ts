import { describe, expect, it } from 'vitest'
import { lineChanges, wordDelta } from './line-changes'

describe('lineChanges', () => {
  it('returns one same run for equal texts', () => {
    expect(lineChanges('a\n\nb', 'a\n\nb')).toEqual([
      { kind: 'same', lines: ['a', '', 'b'] },
    ])
  })

  it('keeps a word change inside one line as a word diff', () => {
    const changes = lineChanges(
      'Intro\n\nYou will recieve a prompt.\n\nEnd',
      'Intro\n\nYou will receive a prompt.\n\nEnd',
    )
    expect(changes).toEqual([
      { kind: 'same', lines: ['Intro', ''] },
      {
        kind: 'changed',
        hunks: [
          { type: 'equal', text: 'You will ', from: 0, to: 9 },
          { type: 'deleted', text: 'recieve', from: 9, to: 16 },
          { type: 'inserted', text: 'receive', at: 16 },
          { type: 'equal', text: ' a prompt.', from: 16, to: 26 },
        ],
      },
      { kind: 'same', lines: ['', 'End'] },
    ])
  })

  it('touches only the changed items of a list', () => {
    const before = '- Tests pass\n- Get a review\n- Write a plan\n- No handover'
    const after =
      '- Tests pass\n- A review is done\n- Write a plan\n- No handover'
    const changes = lineChanges(before, after)
    expect(changes.map((change) => change.kind)).toEqual([
      'same',
      'changed',
      'same',
    ])
    expect(changes[0]).toEqual({ kind: 'same', lines: ['- Tests pass'] })
    expect(changes[2]).toEqual({
      kind: 'same',
      lines: ['- Write a plan', '- No handover'],
    })
  })

  it('shows added lines as inserted and removed lines as deleted', () => {
    expect(lineChanges('a', 'a\nb')).toEqual([
      { kind: 'same', lines: ['a'] },
      { kind: 'changed', hunks: [{ type: 'inserted', text: 'b', at: 0 }] },
    ])
    expect(lineChanges('a\nb', 'a')).toEqual([
      { kind: 'same', lines: ['a'] },
      {
        kind: 'changed',
        hunks: [{ type: 'deleted', text: 'b', from: 0, to: 1 }],
      },
    ])
  })

  it('diffs a run of two lines replaced by one as one change', () => {
    const changes = lineChanges('a\nold one\nold two\nz', 'a\nnew\nz')
    expect(changes.map((change) => change.kind)).toEqual([
      'same',
      'changed',
      'same',
    ])
    const hunks = changes[1]?.kind === 'changed' ? changes[1].hunks : []
    expect(
      hunks
        .filter((hunk) => hunk.type !== 'inserted')
        .map((hunk) => hunk.text)
        .join(''),
    ).toBe('old one\nold two')
    expect(
      hunks
        .filter((hunk) => hunk.type !== 'deleted')
        .map((hunk) => hunk.text)
        .join(''),
    ).toBe('new')
  })

  it('keeps the lines after a deleted block', () => {
    expect(lineChanges('gone\n\nkept\nalso kept', 'kept\nalso kept')).toEqual([
      {
        kind: 'changed',
        hunks: [{ type: 'deleted', text: 'gone\n', from: 0, to: 5 }],
      },
      { kind: 'same', lines: ['kept', 'also kept'] },
    ])
  })

  it('treats a trailing newline difference as no change', () => {
    expect(lineChanges('a\n', 'a')).toEqual([{ kind: 'same', lines: ['a'] }])
  })
})

describe('wordDelta', () => {
  it('counts words added and removed', () => {
    expect(wordDelta('one two three', 'one 2 three four')).toEqual({
      added: 2,
      removed: 1,
    })
  })

  it('returns zeros when only spacing changed', () => {
    expect(wordDelta('one two', 'one  two\n')).toEqual({ added: 0, removed: 0 })
  })

  it('counts only the lines that changed', () => {
    expect(
      wordDelta(
        'Same first line.\n\nOld middle words.\n\nSame last line.',
        'Same first line.\n\nNew middle words.\n\nSame last line.',
      ),
    ).toEqual({ added: 1, removed: 1 })
  })

  it('counts a wholesale replacement as every word removed and added, quickly', () => {
    const prose = (seed: string, count: number) =>
      Array.from(
        { length: count },
        (_, index) => `${seed}${index}a ${seed}${index}b ${seed}${index}c.`,
      ).join('\n\n')
    const before = prose('alpha', 600)
    const after = prose('beta', 400)
    const started = performance.now()
    const delta = wordDelta(before, after)
    expect(performance.now() - started).toBeLessThan(500)
    expect(delta).toEqual({
      added: after.split(/\s+/).length,
      removed: before.split(/\s+/).length,
    })
  })
})
