import { describe, expect, it } from 'vitest'
import { DEFAULT_REVIEW_FOCUS } from '../suggestions/review'
import {
  describeVersion,
  historySummary,
  listChanges,
  markOf,
  mixedLabels,
} from './story'
import type {
  AcceptedChange,
  VersionCause,
  VersionList,
  VersionSummary,
} from './types'

const time = (at: number) => `t${at}`

const summary = (
  id: number,
  cause: VersionCause,
  words: number,
  [wordsAdded, wordsRemoved]: readonly [number, number] = [0, 0],
): VersionSummary => ({ id, at: id, cause, words, wordsAdded, wordsRemoved })

const withVersion = (
  cause: VersionCause,
  words: number,
  counts: readonly [number, number] = [0, 0],
): VersionList => [
  summary(1, { kind: 'started' }, 3, [3, 0]),
  summary(2, cause, words, counts),
]

const describeLast = (versions: VersionList) => {
  const last = versions.at(-1)
  if (!last) throw new Error('empty History')
  return describeVersion(versions, last, time)
}

const change = (overrides: Partial<AcceptedChange>): AcceptedChange => ({
  origin: 'ask',
  instruction: 'Shorter',
  rationale: 'Drops filler.',
  ...overrides,
})

describe('describeVersion', () => {
  it('describes the Started Version by its length', () => {
    expect(describeLast([summary(1, { kind: 'started' }, 3)])).toEqual({
      author: 'file',
      label: 'Started',
      headline: 'Started with 3 words',
    })
  })

  it('names the file of an Opened Version', () => {
    expect(
      describeLast(withVersion({ kind: 'opened', name: 'notes.md' }, 1)),
    ).toEqual({
      author: 'file',
      label: 'Opened',
      headline: 'Opened notes.md',
    })
  })

  it('says a Version came from outside the app', () => {
    expect(describeLast(withVersion({ kind: 'external' }, 1))).toEqual({
      author: 'file',
      label: 'External',
      headline: 'Changed outside Desafinado',
    })
  })

  it('counts the words an Edited Version added and removed', () => {
    expect(describeLast(withVersion({ kind: 'edited' }, 4, [2, 1]))).toEqual({
      author: 'you',
      label: 'You',
      headline: 'You added 2 words and removed 1',
    })
    expect(
      describeLast(withVersion({ kind: 'edited' }, 4, [1, 0])),
    ).toMatchObject({ headline: 'You added 1 word' })
    expect(
      describeLast(withVersion({ kind: 'edited' }, 1, [0, 2])),
    ).toMatchObject({ headline: 'You removed 2 words' })
    expect(
      describeLast(withVersion({ kind: 'edited' }, 3, [0, 0])),
    ).toMatchObject({ headline: 'You changed spacing or formatting' })
  })

  it('reads the counts of an Edited Version off the Version itself', () => {
    expect(
      describeLast([summary(9, { kind: 'edited' }, 12, [2, 0])]),
    ).toMatchObject({ headline: 'You added 2 words' })
  })

  it('uses the Rationale of a single accepted Suggestion', () => {
    expect(
      describeLast(withVersion({ kind: 'accepted', changes: [change({})] }, 1)),
    ).toEqual({
      author: 'ai',
      label: 'AI · Shorter',
      headline: 'Drops filler.',
    })
  })

  it('labels a Review pass Suggestion with its Focus', () => {
    const reviewed = (instruction: string) =>
      describeLast(
        withVersion(
          {
            kind: 'accepted',
            changes: [change({ origin: 'review', instruction })],
          },
          1,
        ),
      ).label
    expect(reviewed('tone')).toBe('AI · Review pass · tone')
    expect(reviewed(DEFAULT_REVIEW_FOCUS)).toBe('AI · Review pass')
  })

  it('counts the Suggestions of an Accept all', () => {
    expect(
      describeLast(
        withVersion(
          {
            kind: 'accepted',
            changes: [
              change({ origin: 'review', instruction: DEFAULT_REVIEW_FOCUS }),
              change({ origin: 'review', instruction: DEFAULT_REVIEW_FOCUS }),
            ],
          },
          1,
        ),
      ),
    ).toEqual({
      author: 'ai',
      label: 'AI · Review pass',
      headline: 'Accepted 2 Suggestions',
    })
  })

  it('labels an Accept all of different requests as Suggestions', () => {
    expect(
      describeLast(
        withVersion(
          {
            kind: 'accepted',
            changes: [change({}), change({ instruction: 'Clearer' })],
          },
          1,
        ),
      ),
    ).toMatchObject({ label: 'AI · Suggestions' })
  })

  it('points a Restored Version at the time of its source', () => {
    expect(describeLast(withVersion({ kind: 'restored', from: 1 }, 1))).toEqual(
      {
        author: 'restore',
        label: 'Restored',
        headline: 'Restored the Version from t1',
      },
    )
    expect(
      describeLast(withVersion({ kind: 'restored', from: 99 }, 1)),
    ).toMatchObject({ headline: 'Restored an earlier Version' })
  })
})

describe('listChanges', () => {
  it('labels each accepted Suggestion with a key by position', () => {
    expect(
      listChanges([
        change({}),
        change({ origin: 'review', instruction: 'tone', rationale: 'Calmer.' }),
      ]),
    ).toEqual([
      { key: '0', label: 'Shorter', rationale: 'Drops filler.' },
      { key: '1', label: 'Review pass · tone', rationale: 'Calmer.' },
    ])
  })
})

describe('mixedLabels', () => {
  it('is true only when the Suggestions came from different requests', () => {
    expect(mixedLabels([change({}), change({})])).toBe(false)
    expect(mixedLabels([change({}), change({ instruction: 'Clearer' })])).toBe(
      true,
    )
  })
})

describe('historySummary', () => {
  it('counts Versions, AI changes and your changes', () => {
    const versions: VersionList = [
      summary(1, { kind: 'started' }, 1),
      summary(2, { kind: 'edited' }, 1),
      summary(3, { kind: 'accepted', changes: [change({})] }, 1),
      summary(4, { kind: 'restored', from: 1 }, 1),
    ]
    expect(historySummary(versions)).toEqual({
      versions: 4,
      fromAi: 1,
      byYou: 2,
    })
  })
})

describe('markOf', () => {
  it('maps each Cause to a Timeline mark', () => {
    expect(markOf({ kind: 'started' })).toBe('file')
    expect(markOf({ kind: 'opened', name: 'a.md' })).toBe('file')
    expect(markOf({ kind: 'external' })).toBe('file')
    expect(markOf({ kind: 'edited' })).toBe('you')
    expect(markOf({ kind: 'accepted', changes: [] })).toBe('ai')
    expect(markOf({ kind: 'restored', from: 1 })).toBe('restore')
  })
})
