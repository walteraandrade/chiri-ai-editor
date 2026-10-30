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
})
