import { ChangeSet } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { ClientError } from '../ai/errors'
import {
  acceptSuggestion,
  activeSuggestion,
  beginSuggestion,
  discardSuggestion,
  emptySuggestions,
  failSuggestion,
  findSuggestion,
  mapSuggestions,
  pendingSuggestionIds,
  rejectSuggestion,
  resolveSuggestion,
  retrySuggestion,
  suggestionAt,
} from './state'
import type {
  Instruction,
  ReadySuggestion,
  SuggestionDraft,
  SuggestionsState,
} from './types'

const SHORTER: Instruction = {
  type: 'quick-action',
  id: 'shorter',
  label: 'Shorter',
  text: 'Make it shorter.',
}

const draft = (
  id: string,
  from: number,
  to: number,
  overrides: Partial<SuggestionDraft> = {},
): SuggestionDraft => ({
  id,
  from,
  to,
  source: 'selection',
  original: 'x'.repeat(to - from),
  instruction: SHORTER,
  ...overrides,
})

const result = (replacement: string, rationale = 'Because.') => ({
  replacement,
  rationale,
  unchanged: false,
})

const begun = (...drafts: SuggestionDraft[]): SuggestionsState =>
  drafts.reduce(beginSuggestion, emptySuggestions)

const ready = (
  state: SuggestionsState,
  id: string,
  replacement = 'changed',
): SuggestionsState => resolveSuggestion(state, id, result(replacement))

const idsOf = (state: SuggestionsState): readonly string[] =>
  state.items.map((item) => item.id)

const mustFind = (state: SuggestionsState, id: string) => {
  const found = findSuggestion(state, id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

describe('beginSuggestion', () => {
  it('creates a pending Suggestion with the request data', () => {
    const state = begun(
      draft('a', 5, 15, { source: 'block', original: 'ten chars!' }),
    )
    expect(state.items).toEqual([
      {
        id: 'a',
        from: 5,
        to: 15,
        source: 'block',
        original: 'ten chars!',
        instruction: SHORTER,
        status: 'pending',
        sequence: 0,
      },
    ])
    expect(state.notice).toBeNull()
  })

  it('keeps many Suggestions open at once, in creation order', () => {
    const state = begun(
      draft('a', 0, 10),
      draft('b', 20, 30),
      draft('c', 40, 50),
    )
    expect(idsOf(state)).toEqual(['a', 'b', 'c'])
    expect(state.items.map((item) => item.sequence)).toEqual([0, 1, 2])
  })

  it('does not treat touching ranges as an overlap', () => {
    const state = begun(draft('a', 0, 10), draft('b', 10, 20))
    expect(idsOf(state)).toEqual(['a', 'b'])
    expect(state.notice).toBeNull()
  })

  it('replaces an open Suggestion that overlaps the new request', () => {
    const state = begun(draft('a', 0, 20))
    const next = beginSuggestion(ready(state, 'a'), draft('b', 10, 30))
    expect(idsOf(next)).toEqual(['b'])
    expect(next.notice?.kind).toBe('replaced')
  })

  it('replaces a pending Suggestion that overlaps the new request', () => {
    const next = beginSuggestion(begun(draft('a', 0, 20)), draft('b', 5, 8))
    expect(idsOf(next)).toEqual(['b'])
    expect(next.notice?.kind).toBe('replaced')
  })

  it('replaces every overlapped Suggestion and keeps the others', () => {
    const state = begun(
      draft('a', 0, 10),
      draft('b', 20, 30),
      draft('c', 40, 50),
    )
    const next = beginSuggestion(state, draft('d', 5, 45))
    expect(idsOf(next)).toEqual(['d'])

    const kept = beginSuggestion(state, draft('e', 8, 22))
    expect(idsOf(kept)).toEqual(['c', 'e'])
  })

  it('gives each new notice a new serial', () => {
    const first = beginSuggestion(begun(draft('a', 0, 10)), draft('b', 0, 10))
    const second = beginSuggestion(first, draft('c', 0, 10))
    expect(second.notice?.serial).toBeGreaterThan(first.notice?.serial ?? -1)
  })
})

describe('resolveSuggestion', () => {
  it('turns a pending Suggestion into a ready one with a diff', () => {
    const state = resolveSuggestion(
      begun(draft('a', 0, 17, { original: 'Hello brave world' })),
      'a',
      result('Hello world', 'Cut a word.'),
    )
    const found = mustFind(state, 'a') as ReadySuggestion
    expect(found.status).toBe('ready')
    expect(found.replacement).toBe('Hello world')
    expect(found.rationale).toBe('Cut a word.')
    expect(found.original).toBe('Hello brave world')
    expect(found.instruction).toEqual(SHORTER)
    expect(found.history).toEqual([])
    expect(found.diff.mode).toBe('word')
    expect(found.sequence).toBe(0)
  })

  it('keeps the original edge whitespace of the Target', () => {
    const state = resolveSuggestion(
      begun(draft('a', 0, 13, { original: '  Hello brave\n' })),
      'a',
      result('Hello world'),
    )
    expect((mustFind(state, 'a') as ReadySuggestion).replacement).toBe(
      '  Hello world\n',
    )
  })

  it('drops the Suggestion with a "no-change" notice when the Replacement is unchanged', () => {
    const state = resolveSuggestion(begun(draft('a', 0, 10)), 'a', {
      replacement: 'xxxxxxxxxx',
      rationale: 'Nothing to do.',
      unchanged: true,
    })
    expect(state.items).toEqual([])
    expect(state.notice?.kind).toBe('no-change')
  })

  it('ignores a result for a Suggestion that is gone', () => {
    const state = begun(draft('a', 0, 10))
    expect(resolveSuggestion(state, 'missing', result('y'))).toBe(state)
  })

  it('ignores a result for a Suggestion that is not pending', () => {
    const readyState = ready(begun(draft('a', 0, 10)), 'a')
    expect(resolveSuggestion(readyState, 'a', result('z'))).toBe(readyState)
  })
})

describe('failSuggestion and retrySuggestion', () => {
  const error: ClientError = { type: 'network', message: 'offline' }

  it('turns a pending Suggestion into an error that keeps the request', () => {
    const state = failSuggestion(begun(draft('a', 3, 9)), 'a', error)
    expect(mustFind(state, 'a')).toMatchObject({
      status: 'error',
      error,
      from: 3,
      to: 9,
      instruction: SHORTER,
      source: 'selection',
    })
  })

  it('ignores a failure for a Suggestion that is gone or not pending', () => {
    const state = ready(begun(draft('a', 0, 10)), 'a')
    expect(failSuggestion(state, 'a', error)).toBe(state)
    expect(failSuggestion(state, 'missing', error)).toBe(state)
  })

  it('retry puts an error back to pending with the same request', () => {
    const failed = failSuggestion(begun(draft('a', 3, 9)), 'a', error)
    const retried = retrySuggestion(failed, 'a')
    expect(mustFind(retried, 'a')).toMatchObject({
      status: 'pending',
      from: 3,
      to: 9,
      instruction: SHORTER,
    })
    expect(pendingSuggestionIds(retried)).toEqual(['a'])
  })

  it('retry ignores Suggestions that are not in error', () => {
    const state = begun(draft('a', 0, 10))
    expect(retrySuggestion(state, 'a')).toBe(state)
    expect(retrySuggestion(state, 'missing')).toBe(state)
  })
})

describe('reject and discard', () => {
  it('reject removes the Suggestion without a notice', () => {
    const state = rejectSuggestion(ready(begun(draft('a', 0, 10)), 'a'), 'a')
    expect(state.items).toEqual([])
    expect(state.notice).toBeNull()
  })

  it('reject also drops pending and error Suggestions', () => {
    const pending = begun(draft('a', 0, 10))
    expect(rejectSuggestion(pending, 'a').items).toEqual([])
    const failed = failSuggestion(pending, 'a', {
      type: 'network',
      message: '',
    })
    expect(rejectSuggestion(failed, 'a').items).toEqual([])
  })

  it('discard removes the Suggestion with the given notice', () => {
    const state = discardSuggestion(
      begun(draft('a', 0, 10)),
      'a',
      'text-changed',
    )
    expect(state.items).toEqual([])
    expect(state.notice?.kind).toBe('text-changed')
  })

  it('leaves the state alone for an unknown id', () => {
    const state = begun(draft('a', 0, 10))
    expect(rejectSuggestion(state, 'x')).toBe(state)
    expect(discardSuggestion(state, 'x', 'text-changed')).toBe(state)
  })
})

describe('mapSuggestions', () => {
  const doc = 'x'.repeat(100)
  const change = (from: number, to: number, insert: string) =>
    ChangeSet.of({ from, to, insert }, doc.length)

  const open = () =>
    ready(ready(begun(draft('a', 20, 40), draft('b', 60, 80)), 'a'), 'b')

  it('shifts Suggestions after an insertion before them', () => {
    const next = mapSuggestions(open(), change(5, 5, 'abc'))
    expect(next.items.map((item) => [item.from, item.to])).toEqual([
      [23, 43],
      [63, 83],
    ])
    expect(next.notice).toBeNull()
  })

  it('shifts Suggestions back after a deletion before them', () => {
    const next = mapSuggestions(open(), change(0, 10, ''))
    expect(next.items.map((item) => [item.from, item.to])).toEqual([
      [10, 30],
      [50, 70],
    ])
  })

  it('keeps a Suggestion untouched by an edit after it', () => {
    const next = mapSuggestions(open(), change(90, 95, 'zz'))
    expect(next.items.map((item) => [item.from, item.to])).toEqual([
      [20, 40],
      [60, 80],
    ])
  })

  it('treats typing at the very start of a Suggestion as outside', () => {
    const next = mapSuggestions(open(), change(20, 20, 'abc'))
    expect(mustFind(next, 'a')).toMatchObject({ from: 23, to: 43 })
  })

  it('treats typing at the very end of a Suggestion as outside', () => {
    const next = mapSuggestions(open(), change(40, 40, 'abc'))
    expect(mustFind(next, 'a')).toMatchObject({ from: 20, to: 40 })
    expect(mustFind(next, 'b')).toMatchObject({ from: 63, to: 83 })
  })

  it('treats an edit that ends where a Suggestion starts as outside', () => {
    const next = mapSuggestions(open(), change(10, 20, 'abc'))
    expect(mustFind(next, 'a')).toMatchObject({ from: 13, to: 33 })
  })

  it('discards a Suggestion when text is inserted inside it', () => {
    const next = mapSuggestions(open(), change(30, 30, 'abc'))
    expect(idsOf(next)).toEqual(['b'])
    expect(next.notice?.kind).toBe('text-changed')
  })

  it('discards a Suggestion when text inside it is deleted', () => {
    const next = mapSuggestions(open(), change(25, 28, ''))
    expect(idsOf(next)).toEqual(['b'])
    expect(next.notice?.kind).toBe('text-changed')
  })

  it('discards a Suggestion when an edit straddles its boundary', () => {
    expect(idsOf(mapSuggestions(open(), change(15, 25, '')))).toEqual(['b'])
    expect(idsOf(mapSuggestions(open(), change(35, 45, '')))).toEqual(['b'])
  })

  it('discards a Suggestion when its whole range is replaced', () => {
    expect(idsOf(mapSuggestions(open(), change(20, 40, 'new')))).toEqual(['b'])
  })

  it('discards a pending Suggestion when its Target is edited', () => {
    const state = begun(draft('a', 20, 40))
    const next = mapSuggestions(state, change(30, 31, 'q'))
    expect(next.items).toEqual([])
    expect(next.notice?.kind).toBe('text-changed')
    expect(pendingSuggestionIds(next)).toEqual([])
  })

  it('discards an error Suggestion when its text is edited', () => {
    const failed = failSuggestion(begun(draft('a', 20, 40)), 'a', {
      type: 'network',
      message: '',
    })
    expect(mapSuggestions(failed, change(30, 31, 'q')).items).toEqual([])
  })

  it('discards several Suggestions hit by one change with a single notice', () => {
    const next = mapSuggestions(open(), change(30, 70, 'q'))
    expect(next.items).toEqual([])
    expect(next.notice?.kind).toBe('text-changed')
  })

  it('returns the same state for a change that touches nothing', () => {
    const state = open()
    expect(mapSuggestions(state, ChangeSet.empty(doc.length))).toBe(state)
  })
})

describe('acceptSuggestion', () => {
  it('removes the Suggestion and does not count its own change as an edit inside', () => {
    const doc = 'x'.repeat(100)
    const state = ready(
      ready(begun(draft('a', 20, 40), draft('b', 60, 80)), 'a'),
      'b',
    )
    const own = ChangeSet.of(
      { from: 20, to: 40, insert: 'y'.repeat(30) },
      doc.length,
    )

    const next = acceptSuggestion(state, 'a', own)

    expect(idsOf(next)).toEqual(['b'])
    expect(next.notice).toBeNull()
    expect(mustFind(next, 'b')).toMatchObject({ from: 70, to: 90 })
  })

  it('still discards another Suggestion if the change reaches inside it', () => {
    const doc = 'x'.repeat(100)
    const state = ready(
      ready(begun(draft('a', 20, 40), draft('b', 60, 80)), 'a'),
      'b',
    )
    const next = acceptSuggestion(
      state,
      'a',
      ChangeSet.of({ from: 30, to: 70, insert: '' }, doc.length),
    )
    expect(next.items).toEqual([])
  })
})

describe('activeSuggestion', () => {
  const open = () =>
    ready(
      ready(
        ready(
          begun(draft('a', 0, 10), draft('b', 20, 30), draft('c', 40, 50)),
          'a',
        ),
        'b',
      ),
      'c',
    )

  it('is undefined without ready Suggestions', () => {
    expect(activeSuggestion(emptySuggestions, 5)).toBeUndefined()
    expect(activeSuggestion(begun(draft('a', 0, 10)), 5)).toBeUndefined()
  })

  it('is the most recently created Suggestion when the cursor is outside', () => {
    expect(activeSuggestion(open(), 15)?.id).toBe('c')
    expect(activeSuggestion(open(), null)?.id).toBe('c')
  })

  it('is the Suggestion containing the cursor', () => {
    expect(activeSuggestion(open(), 25)?.id).toBe('b')
    expect(activeSuggestion(open(), 0)?.id).toBe('a')
    expect(activeSuggestion(open(), 30)?.id).toBe('b')
  })

  it('prefers the most recent of two Suggestions touching at the cursor', () => {
    const touching = ready(
      ready(begun(draft('a', 0, 10), draft('b', 10, 20)), 'a'),
      'b',
    )
    expect(activeSuggestion(touching, 10)?.id).toBe('b')
  })

  it('ignores pending and error Suggestions', () => {
    const state = beginSuggestion(
      ready(begun(draft('a', 0, 10)), 'a'),
      draft('b', 20, 30),
    )
    expect(activeSuggestion(state, 25)?.id).toBe('a')
  })
})

describe('suggestionAt', () => {
  it('finds the Suggestion of any status that contains a position', () => {
    const state = begun(draft('a', 0, 10), draft('b', 20, 30))
    expect(suggestionAt(state, 5)?.id).toBe('a')
    expect(suggestionAt(state, 20)?.id).toBe('b')
    expect(suggestionAt(state, 15)).toBeUndefined()
  })
})
