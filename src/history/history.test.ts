import { describe, expect, it } from 'vitest'
import {
  MAX_VERSIONS,
  markSaved,
  previousVersion,
  recordVersion,
  startHistory,
} from './history'
import type { History } from './types'

const edited = { kind: 'edited' } as const

describe('startHistory', () => {
  it('starts with one Started Version holding the text', () => {
    expect(startHistory('# Notes', 100)).toEqual([
      {
        id: 1,
        at: 100,
        cause: { kind: 'started' },
        text: '# Notes',
        wordsAdded: 2,
        wordsRemoved: 0,
      },
    ])
  })
})

describe('recordVersion', () => {
  it('appends a Version with the next id', () => {
    const history = recordVersion(startHistory('a', 1), {
      text: 'ab',
      cause: edited,
      at: 2,
    })
    expect(history.at(-1)).toEqual({
      id: 2,
      at: 2,
      cause: edited,
      text: 'ab',
      wordsAdded: 1,
      wordsRemoved: 1,
    })
  })

  it('counts the words against the Version before it', () => {
    const wordsOf = (history: History) =>
      history.map(({ wordsAdded, wordsRemoved }) => [wordsAdded, wordsRemoved])
    const history = ['one two', 'one two three', 'one'].reduce<History>(
      (current, text, index) =>
        recordVersion(current, { text, cause: edited, at: index + 2 }),
      startHistory('', 1),
    )
    expect(wordsOf(history)).toEqual([
      [0, 0],
      [2, 0],
      [1, 0],
      [0, 2],
    ])
  })

  it('counts a restored old text against the last Version, not its source', () => {
    const grown = recordVersion(startHistory('one two three', 1), {
      text: 'one two three four',
      cause: edited,
      at: 2,
    })
    const restored = recordVersion(grown, {
      text: 'one two three',
      cause: { kind: 'restored', from: 1 },
      at: 3,
    })
    expect(restored.at(-1)).toMatchObject({ wordsAdded: 0, wordsRemoved: 1 })
  })

  it('skips a Version whose text equals the last one', () => {
    const history = startHistory('same', 1)
    expect(recordVersion(history, { text: 'same', cause: edited, at: 2 })).toBe(
      history,
    )
  })

  it(`keeps at most ${MAX_VERSIONS} Versions, dropping the oldest`, () => {
    const full = Array.from({ length: MAX_VERSIONS + 5 }, (_, index) => index)
      .slice(1)
      .reduce<History>(
        (history, index) =>
          recordVersion(history, {
            text: `v${index}`,
            cause: edited,
            at: index,
          }),
        startHistory('v0', 0),
      )
    expect(full).toHaveLength(MAX_VERSIONS)
    expect(full[0]?.text).toBe('v5')
    expect(full.at(-1)?.id).toBe(MAX_VERSIONS + 5)
  })
})

describe('markSaved', () => {
  it('marks the last Version when it holds the saved text', () => {
    const history = markSaved(startHistory('text', 1), {
      text: 'text',
      name: 'notes.md',
      at: 5,
    })
    expect(history).toEqual([
      {
        id: 1,
        at: 1,
        cause: { kind: 'started' },
        text: 'text',
        saved: 'notes.md',
        wordsAdded: 1,
        wordsRemoved: 0,
      },
    ])
  })

  it('marks the newest Version holding the saved text, even if others followed', () => {
    const history = [
      { kind: 'edited' } as const,
      { kind: 'accepted', changes: [] } as const,
    ].reduce<History>(
      (current, cause, index) =>
        recordVersion(current, {
          text: `v${index + 1}`,
          cause,
          at: index + 2,
        }),
      startHistory('v0', 1),
    )
    const saved = markSaved(history, { text: 'v0', name: 'notes.md', at: 9 })
    expect(saved).toHaveLength(3)
    expect(saved.map((version) => version.saved)).toEqual([
      'notes.md',
      undefined,
      undefined,
    ])
  })

  it('records an Edited Version first when the saved text is newer', () => {
    const history = markSaved(startHistory('old', 1), {
      text: 'new',
      name: 'notes.md',
      at: 5,
    })
    expect(history.at(-1)).toEqual({
      id: 2,
      at: 5,
      cause: edited,
      text: 'new',
      saved: 'notes.md',
      wordsAdded: 1,
      wordsRemoved: 1,
    })
  })
})

describe('previousVersion', () => {
  const history = recordVersion(startHistory('a', 1), {
    text: 'b',
    cause: edited,
    at: 2,
  })

  it('returns the Version before the given one', () => {
    expect(previousVersion(history, 2)?.text).toBe('a')
  })

  it('returns undefined for the first Version or an unknown id', () => {
    expect(previousVersion(history, 1)).toBeUndefined()
    expect(previousVersion(history, 99)).toBeUndefined()
  })
})
