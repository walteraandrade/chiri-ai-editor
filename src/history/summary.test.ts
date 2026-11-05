import { describe, expect, it } from 'vitest'
import { summarize } from './summary'
import type { Version } from './types'

const version = (overrides: Partial<Version> = {}): Version => ({
  id: 4,
  at: 9,
  cause: { kind: 'edited' },
  text: 'three small words',
  ...overrides,
})

describe('summarize', () => {
  it('drops the text and keeps its word count', () => {
    expect(summarize(version({ wordsAdded: 3, wordsRemoved: 0 }))).toEqual({
      id: 4,
      at: 9,
      cause: { kind: 'edited' },
      words: 3,
      wordsAdded: 3,
      wordsRemoved: 0,
    })
  })

  it('keeps the saved file name', () => {
    expect(
      summarize(
        version({
          id: 1,
          cause: { kind: 'started' },
          text: '',
          saved: 'notes.md',
          wordsAdded: 0,
          wordsRemoved: 0,
        }),
      ),
    ).toEqual({
      id: 1,
      at: 9,
      cause: { kind: 'started' },
      words: 0,
      wordsAdded: 0,
      wordsRemoved: 0,
      saved: 'notes.md',
    })
  })

  it('keeps the counts it was stored with, whatever the Version before says', () => {
    const summary = summarize(version({ wordsAdded: 7, wordsRemoved: 5 }), {
      ...version({ id: 3 }),
      text: 'three small words',
    })
    expect(summary).toMatchObject({ wordsAdded: 7, wordsRemoved: 5 })
  })

  it('works the counts out against the Version before when none were stored', () => {
    const summary = summarize(version({ text: 'one 2 three four' }), {
      ...version({ id: 3 }),
      text: 'one two three',
    })
    expect(summary).toMatchObject({ wordsAdded: 2, wordsRemoved: 1 })
  })

  it('works the counts out against an empty text when nothing came before', () => {
    expect(summarize(version())).toMatchObject({
      wordsAdded: 3,
      wordsRemoved: 0,
    })
  })

  it('does not trust a count stored without its pair', () => {
    expect(summarize(version({ wordsAdded: 9 }))).toMatchObject({
      wordsAdded: 3,
      wordsRemoved: 0,
    })
  })
})
