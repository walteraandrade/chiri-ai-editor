import { describe, expect, it } from 'vitest'
import {
  MAX_VERSIONS,
  markSaved,
  previousVersion,
  recordVersion,
  resumeHistory,
  startHistory,
} from './history'
import type { History } from './types'

const edited = { kind: 'edited' } as const

describe('startHistory', () => {
  it('starts with one Started Version holding the text', () => {
    expect(startHistory('# Notes', 100)).toEqual([
      { id: 1, at: 100, cause: { kind: 'started' }, text: '# Notes' },
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
    expect(history.at(-1)).toEqual({ id: 2, at: 2, cause: edited, text: 'ab' })
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
      },
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
    })
  })
})

describe('resumeHistory', () => {
  it('starts a History when nothing was stored', () => {
    expect(resumeHistory(null, 'doc', 9)).toEqual(startHistory('doc', 9))
  })

  it('keeps a stored History that ends with the Document text', () => {
    const stored = startHistory('doc', 1)
    expect(resumeHistory(stored, 'doc', 9)).toBe(stored)
  })

  it('records an Edited Version when the Document moved on', () => {
    const resumed = resumeHistory(startHistory('old', 1), 'newer', 9)
    expect(resumed.at(-1)).toEqual({
      id: 2,
      at: 9,
      cause: edited,
      text: 'newer',
    })
  })

  it('starts fresh from an empty stored History', () => {
    expect(resumeHistory([], 'doc', 9)).toEqual(startHistory('doc', 9))
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
