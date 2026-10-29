import { ChangeSet } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { ClientError } from '../ai/errors'
import { adaptiveDiff } from '../diff/adaptive-diff'
import {
  acceptSuggestion,
  acceptSuggestions,
  activeSuggestion,
  beginRefine,
  beginSuggestion,
  cancelRefine,
  discardSuggestion,
  emptySuggestions,
  failRefine,
  failSuggestion,
  findSuggestion,
  inFlightSuggestionIds,
  instructionHistory,
  mapSuggestions,
  rejectReviewSuggestions,
  rejectSuggestion,
  rejectSuggestions,
  resolveRefine,
  resolveSuggestion,
  retryRefine,
  retrySuggestion,
  showVersion,
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
        origin: 'ask',
      },
    ])
    expect(state.notice).toBeNull()
  })

  it('keeps the origin the request came with', () => {
    const state = begun(
      draft('a', 0, 10),
      draft('b', 20, 30, { origin: 'review' }),
    )
    expect(state.items.map((item) => item.origin)).toEqual(['ask', 'review'])
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
    expect(found.history).toEqual([
      {
        instruction: SHORTER,
        replacement: 'Hello world',
        rationale: 'Cut a word.',
      },
    ])
    expect(found.shown).toBe(0)
    expect(found.refine).toEqual({ status: 'idle' })
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
    expect(inFlightSuggestionIds(retried)).toEqual(['a'])
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

describe('rejectSuggestions', () => {
  it('removes every listed Suggestion without a notice', () => {
    const state = begun(
      draft('a', 0, 10),
      draft('b', 20, 30),
      draft('c', 40, 50),
    )
    const next = rejectSuggestions(state, ['a', 'c', 'missing'])
    expect(idsOf(next)).toEqual(['b'])
    expect(next.notice).toBeNull()
  })

  it('returns the same state when nothing matches', () => {
    const state = begun(draft('a', 0, 10))
    expect(rejectSuggestions(state, ['x'])).toBe(state)
  })
})

describe('rejectReviewSuggestions', () => {
  const mixed = () =>
    begun(
      draft('a', 0, 10),
      draft('r1', 20, 30, { origin: 'review' }),
      draft('r2', 40, 50, { origin: 'review' }),
      draft('b', 60, 70),
    )

  it('drops only Suggestions that came from a Review pass', () => {
    const next = rejectReviewSuggestions(ready(ready(mixed(), 'r1'), 'a'))
    expect(idsOf(next)).toEqual(['a', 'b'])
    expect(next.notice).toBeNull()
  })

  it('drops them whatever their status', () => {
    const refining = beginRefine(ready(mixed(), 'r1'), 'r1', SHORTER)
    expect(idsOf(rejectReviewSuggestions(refining))).toEqual(['a', 'b'])
  })

  it('returns the same state without review Suggestions', () => {
    const state = begun(draft('a', 0, 10))
    expect(rejectReviewSuggestions(state)).toBe(state)
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
    expect(inFlightSuggestionIds(next)).toEqual([])
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

describe('acceptSuggestions', () => {
  it('removes every accepted Suggestion and maps the others through the one change', () => {
    const state = ready(
      ready(
        ready(
          begun(draft('a', 0, 10), draft('b', 20, 30), draft('c', 40, 50)),
          'a',
        ),
        'b',
      ),
      'c',
    )
    const changes = ChangeSet.of(
      [
        { from: 0, to: 10, insert: 'x' },
        { from: 20, to: 30, insert: 'yy' },
      ],
      60,
    )
    const next = acceptSuggestions(state, ['a', 'b'], changes)
    expect(idsOf(next)).toEqual(['c'])
    expect(next.items[0]).toMatchObject({ from: 40 - 9 - 8, to: 50 - 9 - 8 })
    expect(next.notice).toBeNull()
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

  describe('with review Suggestions', () => {
    const reviewDraft = (id: string, from: number, to: number) =>
      draft(id, from, to, { origin: 'review' })

    const streamed = () =>
      ready(
        ready(
          ready(
            begun(
              reviewDraft('r1', 0, 10),
              reviewDraft('r2', 20, 30),
              reviewDraft('r3', 40, 50),
            ),
            'r1',
          ),
          'r2',
        ),
        'r3',
      )

    it('falls back to the first, most important one, not the newest arrival', () => {
      expect(activeSuggestion(streamed(), null)?.id).toBe('r1')
      expect(activeSuggestion(streamed(), 15)?.id).toBe('r1')
    })

    it('does not jump while more arrive', () => {
      const early = ready(begun(reviewDraft('r1', 0, 10)), 'r1')
      const later = ready(
        beginSuggestion(early, reviewDraft('r2', 20, 30)),
        'r2',
      )
      expect(activeSuggestion(early, null)?.id).toBe('r1')
      expect(activeSuggestion(later, null)?.id).toBe('r1')
    })

    it('still follows the cursor into a review Suggestion', () => {
      expect(activeSuggestion(streamed(), 45)?.id).toBe('r3')
    })

    it('prefers the newest Suggestion the user asked for', () => {
      const state = ready(beginSuggestion(streamed(), draft('a', 60, 70)), 'a')
      expect(activeSuggestion(state, null)?.id).toBe('a')
      expect(activeSuggestion(state, 25)?.id).toBe('r2')
    })

    it('uses the newest asked one when it was created before the pass', () => {
      const asked = ready(begun(draft('a', 60, 70)), 'a')
      const state = ready(
        beginSuggestion(asked, reviewDraft('r1', 0, 10)),
        'r1',
      )
      expect(activeSuggestion(state, null)?.id).toBe('a')
    })
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

describe('refine', () => {
  const ORIGINAL = 'Hello brave new world'
  const FORMAL: Instruction = { type: 'free-text', text: 'Now more formal.' }
  const SHORTEST: Instruction = { type: 'free-text', text: 'Make it tiny.' }
  const error: ClientError = { type: 'network', message: 'offline' }

  const opened = (): SuggestionsState =>
    ready(
      begun(draft('a', 10, 31, { original: ORIGINAL, source: 'block' })),
      'a',
      'Hello new world',
    )

  const readyOf = (state: SuggestionsState, id = 'a'): ReadySuggestion => {
    const found = mustFind(state, id)
    if (found.status !== 'ready') throw new Error(`${id} is not ready`)
    return found
  }

  const working = (instruction: Instruction = FORMAL): SuggestionsState =>
    beginRefine(opened(), 'a', instruction)

  describe('beginRefine', () => {
    it('marks a ready Suggestion as working and keeps what it shows', () => {
      const before = readyOf(opened())
      const after = readyOf(beginRefine(opened(), 'a', FORMAL))
      expect(after.refine).toEqual({ status: 'working', instruction: FORMAL })
      expect(after).toEqual({ ...before, refine: after.refine })
      expect(inFlightSuggestionIds(beginRefine(opened(), 'a', FORMAL))).toEqual(
        ['a'],
      )
    })

    it('can start again after a failure, with a new Instruction', () => {
      const failed = failRefine(working(), 'a', error)
      const again = readyOf(beginRefine(failed, 'a', SHORTEST))
      expect(again.refine).toEqual({ status: 'working', instruction: SHORTEST })
    })

    it('ignores a Suggestion that is already refining', () => {
      const state = working()
      expect(beginRefine(state, 'a', SHORTEST)).toBe(state)
    })

    it('ignores unknown, pending and error Suggestions', () => {
      const pending = begun(draft('a', 0, 10))
      expect(beginRefine(pending, 'a', FORMAL)).toBe(pending)
      expect(beginRefine(pending, 'x', FORMAL)).toBe(pending)
      const failed = failSuggestion(pending, 'a', error)
      expect(beginRefine(failed, 'a', FORMAL)).toBe(failed)
    })
  })

  describe('resolveRefine', () => {
    it('replaces the Replacement and the Rationale in place', () => {
      const before = readyOf(working())
      const state = resolveRefine(
        working(),
        'a',
        result('Greetings, world', 'More formal.'),
      )
      const after = readyOf(state)
      expect(after).toMatchObject({
        id: 'a',
        from: before.from,
        to: before.to,
        sequence: before.sequence,
        status: 'ready',
        original: ORIGINAL,
        instruction: SHORTER,
        replacement: 'Greetings, world',
        rationale: 'More formal.',
        refine: { status: 'idle' },
      })
      expect(state.items).toHaveLength(1)
      expect(state.notice).toBeNull()
    })

    it('always diffs against the original text', () => {
      const after = readyOf(
        resolveRefine(working(), 'a', result('Greetings, world')),
      )
      expect(after.diff).toEqual(adaptiveDiff(ORIGINAL, 'Greetings, world'))
      expect(after.diff).not.toEqual(
        adaptiveDiff('Hello new world', after.replacement),
      )
    })

    it('recomputes the diff mode from the original and the new Replacement', () => {
      const word = readyOf(opened())
      expect(word.diff.mode).toBe('word')
      const block = readyOf(
        resolveRefine(
          working(),
          'a',
          result('Salutations to everyone present'),
        ),
      )
      expect(block.diff.mode).toBe('block')
    })

    it('appends a step to the history, oldest first', () => {
      const first = resolveRefine(working(), 'a', result('Hi world', 'Short.'))
      const second = resolveRefine(
        beginRefine(first, 'a', SHORTEST),
        'a',
        result('Hi', 'Tiny.'),
      )
      expect(readyOf(second).history).toEqual([
        {
          instruction: SHORTER,
          replacement: 'Hello new world',
          rationale: 'Because.',
        },
        { instruction: FORMAL, replacement: 'Hi world', rationale: 'Short.' },
        { instruction: SHORTEST, replacement: 'Hi', rationale: 'Tiny.' },
      ])
      expect(readyOf(second).original).toBe(ORIGINAL)
      expect(readyOf(second).replacement).toBe('Hi')
    })

    it('keeps the edge whitespace of the original', () => {
      const state = resolveRefine(
        beginRefine(
          resolveSuggestion(
            begun(draft('a', 0, 14, { original: '  Hello brave\n' })),
            'a',
            result('Hello'),
          ),
          'a',
          FORMAL,
        ),
        'a',
        result('Greetings'),
      )
      expect(readyOf(state).replacement).toBe('  Greetings\n')
    })

    it('keeps the current Replacement and shows "no change" when the result equals it', () => {
      const before = readyOf(working())
      const state = resolveRefine(working(), 'a', result('Hello new world'))
      expect(readyOf(state)).toEqual({ ...before, refine: { status: 'idle' } })
      expect(state.notice?.kind).toBe('no-change')
    })

    it('treats surrounding whitespace as no difference from the latest Replacement', () => {
      const state = resolveRefine(
        working(),
        'a',
        result('  Hello new world \n'),
      )
      expect(readyOf(state).history).toHaveLength(1)
      expect(state.notice?.kind).toBe('no-change')
    })

    it('keeps the current Replacement and shows "no change" when the result is the original', () => {
      const before = readyOf(working())
      const state = resolveRefine(working(), 'a', {
        replacement: ORIGINAL,
        rationale: 'Back to the start.',
        unchanged: true,
      })
      expect(readyOf(state)).toEqual({ ...before, refine: { status: 'idle' } })
      expect(state.notice?.kind).toBe('no-change')
    })

    it('ignores a result for a Suggestion that is gone or not refining', () => {
      const idle = opened()
      expect(resolveRefine(idle, 'a', result('x'))).toBe(idle)
      expect(resolveRefine(idle, 'missing', result('x'))).toBe(idle)
      const failed = failRefine(working(), 'a', error)
      expect(resolveRefine(failed, 'a', result('x'))).toBe(failed)
    })
  })

  describe('failRefine and retryRefine', () => {
    it('records the error and keeps the current Replacement, Rationale and history', () => {
      const before = readyOf(working())
      const failed = readyOf(failRefine(working(), 'a', error))
      expect(failed.refine).toEqual({
        status: 'failed',
        instruction: FORMAL,
        error,
      })
      expect(failed).toEqual({ ...before, refine: failed.refine })
      expect(failed.status).toBe('ready')
      expect(inFlightSuggestionIds(failRefine(working(), 'a', error))).toEqual(
        [],
      )
    })

    it('ignores a failure for a Suggestion that is gone or not refining', () => {
      const idle = opened()
      expect(failRefine(idle, 'a', error)).toBe(idle)
      expect(failRefine(idle, 'missing', error)).toBe(idle)
    })

    it('retry runs the same Instruction again and clears the error', () => {
      const retried = readyOf(
        retryRefine(failRefine(working(), 'a', error), 'a'),
      )
      expect(retried.refine).toEqual({ status: 'working', instruction: FORMAL })
    })

    it('retry then success appends the step', () => {
      const state = resolveRefine(
        retryRefine(failRefine(working(), 'a', error), 'a'),
        'a',
        result('Greetings'),
      )
      expect(readyOf(state).history.map((step) => step.instruction)).toEqual([
        SHORTER,
        FORMAL,
      ])
    })

    it('retry ignores Suggestions that did not fail a Refine', () => {
      const idle = opened()
      expect(retryRefine(idle, 'a')).toBe(idle)
      const state = working()
      expect(retryRefine(state, 'a')).toBe(state)
      expect(retryRefine(state, 'missing')).toBe(state)
    })
  })

  describe('cancelRefine', () => {
    it('puts a working Refine back to idle and keeps what the Suggestion shows', () => {
      const before = readyOf(opened())
      const state = cancelRefine(working(), 'a')
      expect(readyOf(state)).toEqual(before)
      expect(state.notice).toBeNull()
      expect(inFlightSuggestionIds(state)).toEqual([])
    })

    it('dismisses the error of a failed Refine and keeps the Replacement', () => {
      const before = readyOf(opened())
      const state = cancelRefine(failRefine(working(), 'a', error), 'a')
      expect(readyOf(state)).toEqual(before)
      expect(state.notice).toBeNull()
    })

    it('keeps the history of earlier Refines', () => {
      const refined = resolveRefine(working(), 'a', result('Hi world'))
      const state = cancelRefine(beginRefine(refined, 'a', SHORTEST), 'a')
      expect(readyOf(state).history).toHaveLength(2)
      expect(readyOf(state).replacement).toBe('Hi world')
    })

    it('ignores a late result for the cancelled Refine and allows a new one', () => {
      const cancelled = cancelRefine(working(), 'a')
      expect(resolveRefine(cancelled, 'a', result('late'))).toBe(cancelled)
      expect(failRefine(cancelled, 'a', error)).toBe(cancelled)
      expect(readyOf(beginRefine(cancelled, 'a', SHORTEST)).refine).toEqual({
        status: 'working',
        instruction: SHORTEST,
      })
    })

    it('ignores idle, pending and unknown Suggestions', () => {
      const idle = opened()
      expect(cancelRefine(idle, 'a')).toBe(idle)
      expect(cancelRefine(idle, 'missing')).toBe(idle)
      const pending = begun(draft('a', 0, 10))
      expect(cancelRefine(pending, 'a')).toBe(pending)
    })
  })

  const threeSteps = (): SuggestionsState =>
    resolveRefine(
      beginRefine(
        resolveRefine(working(), 'a', result('Hi world', 'Short.')),
        'a',
        SHORTEST,
      ),
      'a',
      result('Hi', 'Tiny.'),
    )

  describe('showVersion', () => {
    it('shows the newest step after each Refine', () => {
      expect(readyOf(opened()).shown).toBe(0)
      expect(readyOf(threeSteps()).shown).toBe(2)
    })

    it('makes the Replacement, Rationale and diff follow the shown step', () => {
      const first = readyOf(showVersion(threeSteps(), 'a', 0))
      expect(first).toMatchObject({
        shown: 0,
        replacement: 'Hello new world',
        rationale: 'Because.',
        original: ORIGINAL,
        refine: { status: 'idle' },
      })
      expect(first.diff).toEqual(adaptiveDiff(ORIGINAL, 'Hello new world'))
      expect(first.history).toEqual(readyOf(threeSteps()).history)
      const second = readyOf(showVersion(threeSteps(), 'a', 1))
      expect(second).toMatchObject({
        shown: 1,
        replacement: 'Hi world',
        rationale: 'Short.',
      })
      expect(second.diff).toEqual(adaptiveDiff(ORIGINAL, 'Hi world'))
    })

    it('steps back to the newest step', () => {
      const back = readyOf(
        showVersion(showVersion(threeSteps(), 'a', 0), 'a', 2),
      )
      expect(back).toEqual(readyOf(threeSteps()))
    })

    it('ignores an index outside the history', () => {
      const state = threeSteps()
      expect(showVersion(state, 'a', -1)).toBe(state)
      expect(showVersion(state, 'a', 3)).toBe(state)
      expect(showVersion(state, 'a', 0.5)).toBe(state)
    })

    it('ignores the step already shown', () => {
      const state = threeSteps()
      expect(showVersion(state, 'a', 2)).toBe(state)
    })

    it('ignores a Suggestion that is refining', () => {
      const state = beginRefine(threeSteps(), 'a', FORMAL)
      expect(showVersion(state, 'a', 0)).toBe(state)
    })

    it('still steps after a failed Refine and dismisses its error, so Retry never runs on another step', () => {
      const failed = failRefine(
        beginRefine(threeSteps(), 'a', FORMAL),
        'a',
        error,
      )
      const stepped = showVersion(failed, 'a', 0)
      expect(readyOf(stepped).shown).toBe(0)
      expect(readyOf(stepped).refine).toEqual({ status: 'idle' })
      expect(readyOf(stepped).history).toHaveLength(3)
      expect(retryRefine(stepped, 'a')).toBe(stepped)
    })

    it('ignores unknown, pending and error Suggestions', () => {
      const pending = begun(draft('a', 0, 10))
      expect(showVersion(pending, 'a', 0)).toBe(pending)
      const idle = threeSteps()
      expect(showVersion(idle, 'missing', 0)).toBe(idle)
      const failed = failSuggestion(pending, 'a', error)
      expect(showVersion(failed, 'a', 0)).toBe(failed)
    })

    it('leaves other Suggestions and the notice alone', () => {
      const state = ready(
        beginSuggestion(threeSteps(), draft('b', 40, 50)),
        'b',
      )
      const next = showVersion(state, 'a', 0)
      expect(mustFind(next, 'b')).toBe(mustFind(state, 'b'))
      expect(next.notice).toBe(state.notice)
    })
  })

  describe('Refine from an earlier step', () => {
    const fromFirst = (): SuggestionsState =>
      beginRefine(showVersion(threeSteps(), 'a', 0), 'a', FORMAL)

    it('drops the later steps and appends the new one on success', () => {
      const after = readyOf(
        resolveRefine(fromFirst(), 'a', result('Good day, world', 'Formal.')),
      )
      expect(after.history).toEqual([
        {
          instruction: SHORTER,
          replacement: 'Hello new world',
          rationale: 'Because.',
        },
        {
          instruction: FORMAL,
          replacement: 'Good day, world',
          rationale: 'Formal.',
        },
      ])
      expect(after).toMatchObject({
        shown: 1,
        replacement: 'Good day, world',
        rationale: 'Formal.',
        refine: { status: 'idle' },
      })
      expect(after.diff).toEqual(adaptiveDiff(ORIGINAL, 'Good day, world'))
    })

    it('keeps every step on "no change" for the shown Replacement', () => {
      const state = resolveRefine(fromFirst(), 'a', result('Hello new world'))
      expect(readyOf(state).history).toHaveLength(3)
      expect(readyOf(state).shown).toBe(0)
      expect(state.notice?.kind).toBe('no-change')
    })

    it('keeps every step when the Refine fails', () => {
      const failed = readyOf(failRefine(fromFirst(), 'a', error))
      expect(failed.history).toHaveLength(3)
      expect(failed.shown).toBe(0)
      expect(failed.replacement).toBe('Hello new world')
    })

    it('cuts after the shown step when a retry succeeds', () => {
      const state = resolveRefine(
        retryRefine(failRefine(fromFirst(), 'a', error), 'a'),
        'a',
        result('Good day, world'),
      )
      expect(readyOf(state).history.map((step) => step.replacement)).toEqual([
        'Hello new world',
        'Good day, world',
      ])
    })

    it('keeps every step when the Refine is cancelled', () => {
      const cancelled = readyOf(cancelRefine(fromFirst(), 'a'))
      expect(cancelled).toEqual(readyOf(showVersion(threeSteps(), 'a', 0)))
    })
  })

  describe('while refining', () => {
    it('Accept removes the Suggestion and nothing is in flight', () => {
      const doc = 'x'.repeat(100)
      const own = ChangeSet.of({ from: 10, to: 31, insert: 'new' }, doc.length)
      const state = acceptSuggestion(working(), 'a', own)
      expect(state.items).toEqual([])
      expect(state.notice).toBeNull()
      expect(inFlightSuggestionIds(state)).toEqual([])
    })

    it('Reject removes the Suggestion without a notice', () => {
      const state = rejectSuggestion(working(), 'a')
      expect(state.items).toEqual([])
      expect(state.notice).toBeNull()
      expect(inFlightSuggestionIds(state)).toEqual([])
    })

    it('Discard removes the Suggestion with a notice', () => {
      const state = discardSuggestion(working(), 'a', 'replaced')
      expect(state.items).toEqual([])
      expect(state.notice?.kind).toBe('replaced')
    })

    it('a late result after Reject changes nothing', () => {
      const gone = rejectSuggestion(working(), 'a')
      expect(resolveRefine(gone, 'a', result('late'))).toBe(gone)
      expect(failRefine(gone, 'a', error)).toBe(gone)
    })

    it('a newer request over the range replaces the refining Suggestion', () => {
      const next = beginSuggestion(working(), draft('b', 15, 25))
      expect(idsOf(next)).toEqual(['b'])
      expect(next.notice?.kind).toBe('replaced')
      expect(inFlightSuggestionIds(next)).toEqual(['b'])
    })

    it('shifts the range for an edit outside and keeps refining', () => {
      const doc = 'x'.repeat(100)
      const next = mapSuggestions(
        working(),
        ChangeSet.of({ from: 0, insert: 'abc' }, doc.length),
      )
      expect(readyOf(next)).toMatchObject({
        from: 13,
        to: 34,
        refine: { status: 'working', instruction: FORMAL },
      })
      expect(next.notice).toBeNull()
    })

    it('an edit inside Discards the Suggestion and stops the refine', () => {
      const doc = 'x'.repeat(100)
      const next = mapSuggestions(
        working(),
        ChangeSet.of({ from: 20, insert: 'q' }, doc.length),
      )
      expect(next.items).toEqual([])
      expect(next.notice?.kind).toBe('text-changed')
      expect(inFlightSuggestionIds(next)).toEqual([])
    })
  })
})

describe('instructionHistory', () => {
  it('lists the first Instruction and every Refine, oldest first', () => {
    const FORMAL: Instruction = { type: 'free-text', text: 'Now more formal.' }
    const state = resolveRefine(
      beginRefine(ready(begun(draft('a', 0, 10)), 'a', 'one'), 'a', FORMAL),
      'a',
      result('two'),
    )
    const found = mustFind(state, 'a')
    if (found.status !== 'ready') throw new Error('not ready')
    expect(instructionHistory(found)).toEqual([
      'Make it shorter.',
      'Now more formal.',
    ])
  })

  it('stops at the shown step', () => {
    const FORMAL: Instruction = { type: 'free-text', text: 'Now more formal.' }
    const state = showVersion(
      resolveRefine(
        beginRefine(ready(begun(draft('a', 0, 10)), 'a', 'one'), 'a', FORMAL),
        'a',
        result('two'),
      ),
      'a',
      0,
    )
    const found = mustFind(state, 'a')
    if (found.status !== 'ready') throw new Error('not ready')
    expect(instructionHistory(found)).toEqual(['Make it shorter.'])
  })
})

describe('inFlightSuggestionIds', () => {
  it('lists pending Suggestions', () => {
    const state = begun(draft('a', 0, 10), draft('b', 20, 30))
    expect(inFlightSuggestionIds(ready(state, 'a'))).toEqual(['b'])
  })
})
