import { describe, expect, it } from 'vitest'
import { DEFAULT_REVIEW_FOCUS } from '../suggestions/review'
import { recordVersion, startHistory } from './history'
import {
  describeVersion,
  historySummary,
  listChanges,
  markOf,
  mixedLabels,
} from './story'
import type { AcceptedChange, History, VersionCause } from './types'

const time = (at: number) => `t${at}`

const withVersion = (cause: VersionCause, text: string): History =>
  recordVersion(startHistory('one two three', 1), { text, cause, at: 2 })

const describeLast = (history: History) => {
  const last = history.at(-1)
  if (!last) throw new Error('empty History')
  return describeVersion(history, last, time)
}

const change = (overrides: Partial<AcceptedChange>): AcceptedChange => ({
  origin: 'ask',
  instruction: 'Shorter',
  rationale: 'Drops filler.',
  ...overrides,
})

describe('describeVersion', () => {
  it('describes the Started Version by its length', () => {
    const history = startHistory('one two three', 1)
    expect(describeLast(history)).toEqual({
      author: 'file',
      label: 'Started',
      headline: 'Started with 3 words',
    })
  })

  it('names the file of an Opened Version', () => {
    expect(
      describeLast(withVersion({ kind: 'opened', name: 'notes.md' }, 'x')),
    ).toEqual({
      author: 'file',
      label: 'Opened',
      headline: 'Opened notes.md',
    })
  })

  it('counts the words of an Edited Version', () => {
    expect(
      describeLast(withVersion({ kind: 'edited' }, 'one 2 three four')),
    ).toEqual({
      author: 'you',
      label: 'You',
      headline: 'You added 2 words and removed 1',
    })
    expect(
      describeLast(withVersion({ kind: 'edited' }, 'one two three four')),
    ).toMatchObject({ headline: 'You added 1 word' })
    expect(describeLast(withVersion({ kind: 'edited' }, 'one'))).toMatchObject({
      headline: 'You removed 2 words',
    })
    expect(
      describeLast(withVersion({ kind: 'edited' }, 'one  two three')),
    ).toMatchObject({ headline: 'You changed spacing or formatting' })
  })

  it('uses the Rationale of a single accepted Suggestion', () => {
    expect(
      describeLast(
        withVersion({ kind: 'accepted', changes: [change({})] }, 'one'),
      ),
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
          'one',
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
          'one',
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
          'one',
        ),
      ),
    ).toMatchObject({ label: 'AI · Suggestions' })
  })

  it('points a Restored Version at the time of its source', () => {
    expect(
      describeLast(withVersion({ kind: 'restored', from: 1 }, 'x')),
    ).toEqual({
      author: 'restore',
      label: 'Restored',
      headline: 'Restored the Version from t1',
    })
    expect(
      describeLast(withVersion({ kind: 'restored', from: 99 }, 'x')),
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
    const history = [
      { kind: 'edited' } as const,
      { kind: 'accepted', changes: [change({})] } as const,
      { kind: 'restored', from: 1 } as const,
    ].reduce<History>(
      (current, cause, index) =>
        recordVersion(current, { text: `v${index}`, cause, at: index + 2 }),
      startHistory('start', 1),
    )
    expect(historySummary(history)).toEqual({
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
    expect(markOf({ kind: 'edited' })).toBe('you')
    expect(markOf({ kind: 'accepted', changes: [] })).toBe('ai')
    expect(markOf({ kind: 'restored', from: 1 })).toBe('restore')
  })
})
