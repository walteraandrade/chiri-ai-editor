import { ChangeSet, Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { ValidatedEdit } from '../ai/edits'
import { type Block, extractBlocks } from '../blocks/extract-blocks'
import {
  acceptAllPlan,
  DEFAULT_REVIEW_FOCUS,
  mapBlockRange,
  occupiedBlockIds,
  openReviewCount,
  placeReviewEdit,
  reviewInstruction,
  reviewNoticeText,
  reviewSummary,
  reviewTaskLabel,
} from './review'
import {
  beginSuggestion,
  emptySuggestions,
  failSuggestion,
  findSuggestion,
  resolveSuggestion,
} from './state'
import type { SuggestionDraft, SuggestionsState } from './types'

const DOC = [
  '# Title',
  '',
  'First paragraph here.',
  '',
  'Second paragraph here.',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  'Third paragraph here.',
  '',
].join('\n')

const blocks = extractBlocks(DOC)

const blockNamed = (text: string): Block => {
  const found = blocks.find((block) => block.text === text)
  if (!found) throw new Error(`no block ${text}`)
  return found
}

const FIRST = blockNamed('First paragraph here.')
const SECOND = blockNamed('Second paragraph here.')
const THIRD = blockNamed('Third paragraph here.')

const editOn = (block: Block, replacement = `${block.text} Better.`) =>
  ({
    blockId: block.id,
    replacement,
    rationale: 'Clearer.',
    block,
  }) satisfies ValidatedEdit

const change = (from: number, to: number, insert: string) =>
  ChangeSet.of({ from, to, insert }, DOC.length)

const unchanged = ChangeSet.empty(DOC.length)

const docAfter = (changes: ChangeSet): string =>
  changes.apply(Text.of(DOC.split('\n'))).toString()

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
  original: DOC.slice(from, to),
  instruction: { type: 'free-text', text: 'x' },
  ...overrides,
})

const result = (replacement: string) => ({
  replacement,
  rationale: 'Because.',
  unchanged: false,
})

const stateOf = (...drafts: SuggestionDraft[]): SuggestionsState =>
  drafts.reduce(beginSuggestion, emptySuggestions)

const readyOf = (state: SuggestionsState, id: string, replacement: string) =>
  resolveSuggestion(state, id, result(replacement))

describe('reviewInstruction', () => {
  it('uses the Focus as a free-text Instruction', () => {
    expect(reviewInstruction('  tone only ')).toEqual({
      type: 'free-text',
      text: 'tone only',
    })
  })

  it('falls back to the default criteria without a Focus', () => {
    expect(reviewInstruction('')).toEqual({
      type: 'free-text',
      text: DEFAULT_REVIEW_FOCUS,
    })
    expect(reviewInstruction('   ').text).toBe(DEFAULT_REVIEW_FOCUS)
  })
})

describe('occupiedBlockIds', () => {
  it('lists Blocks that overlap a pending, ready or failed Suggestion', () => {
    const base = stateOf(
      draft('a', FIRST.from, FIRST.to),
      draft('b', SECOND.from + 3, SECOND.from + 8),
      draft('c', THIRD.from, THIRD.to),
    )
    const state = failSuggestion(readyOf(base, 'b', 'x'), 'c', {
      type: 'network',
      message: 'offline',
    })
    expect(occupiedBlockIds(state, blocks)).toEqual(
      new Set([FIRST.id, SECOND.id, THIRD.id]),
    )
  })

  it('leaves free Blocks out, including a Block that only touches a Suggestion', () => {
    const state = stateOf(draft('a', FIRST.from, FIRST.to))
    expect(occupiedBlockIds(state, blocks)).toEqual(new Set([FIRST.id]))
  })

  it('is empty without Suggestions', () => {
    expect(occupiedBlockIds(emptySuggestions, blocks)).toEqual(new Set())
  })
})

describe('mapBlockRange', () => {
  it('keeps the range when nothing changed', () => {
    expect(mapBlockRange(SECOND, unchanged)).toEqual({
      from: SECOND.from,
      to: SECOND.to,
    })
  })

  it('shifts the range after an insertion before it', () => {
    expect(mapBlockRange(SECOND, change(0, 0, 'Intro.\n\n'))).toEqual({
      from: SECOND.from + 8,
      to: SECOND.to + 8,
    })
  })

  it('shifts the range back after a deletion before it', () => {
    expect(
      mapBlockRange(SECOND, change(FIRST.from, FIRST.from + 6, '')),
    ).toEqual({ from: SECOND.from - 6, to: SECOND.to - 6 })
  })

  it('keeps the range for an edit after it', () => {
    expect(mapBlockRange(FIRST, change(THIRD.from, THIRD.from, 'x'))).toEqual({
      from: FIRST.from,
      to: FIRST.to,
    })
  })

  it('treats typing at the very start or end of the Block as outside', () => {
    expect(
      mapBlockRange(SECOND, change(SECOND.from, SECOND.from, 'x')),
    ).toEqual({ from: SECOND.from + 1, to: SECOND.to + 1 })
    expect(mapBlockRange(SECOND, change(SECOND.to, SECOND.to, 'x'))).toEqual({
      from: SECOND.from,
      to: SECOND.to,
    })
  })

  it('returns null when text is inserted inside the Block', () => {
    expect(
      mapBlockRange(SECOND, change(SECOND.from + 4, SECOND.from + 4, 'x')),
    ).toBeNull()
  })

  it('returns null when text inside the Block is deleted or replaced', () => {
    expect(
      mapBlockRange(SECOND, change(SECOND.from + 2, SECOND.from + 5, '')),
    ).toBeNull()
    expect(
      mapBlockRange(SECOND, change(SECOND.from, SECOND.to, 'Gone.')),
    ).toBeNull()
  })

  it('returns null when an edit straddles the Block boundary', () => {
    expect(
      mapBlockRange(SECOND, change(FIRST.to - 2, SECOND.from + 3, '')),
    ).toBeNull()
  })

  it('uses every change since the request started', () => {
    const first = change(0, 0, 'Intro.\n\n')
    const second = ChangeSet.of(
      { from: THIRD.from + 8, to: THIRD.from + 8, insert: 'x' },
      DOC.length + 8,
    )
    expect(mapBlockRange(SECOND, first.compose(second))).toEqual({
      from: SECOND.from + 8,
      to: SECOND.to + 8,
    })
    const inside = ChangeSet.of(
      { from: SECOND.from + 8 + 2, to: SECOND.from + 8 + 2, insert: 'z' },
      DOC.length + 8,
    )
    expect(mapBlockRange(SECOND, first.compose(inside))).toBeNull()
  })
})

describe('placeReviewEdit', () => {
  const place = (
    edit: ValidatedEdit,
    overrides: {
      state?: SuggestionsState
      changes?: ChangeSet
      doc?: string
    } = {},
  ) =>
    placeReviewEdit({
      state: overrides.state ?? emptySuggestions,
      edit,
      changes: overrides.changes ?? unchanged,
      doc: overrides.doc ?? DOC,
      id: 's1',
      focus: 'tone only',
    })

  it('places the edit on its Block as a review Suggestion', () => {
    const placed = place(editOn(SECOND, 'Second one.'))
    expect(placed).toEqual({
      type: 'placed',
      draft: {
        id: 's1',
        from: SECOND.from,
        to: SECOND.to,
        source: 'block',
        original: SECOND.text,
        instruction: { type: 'free-text', text: 'tone only' },
        origin: 'review',
      },
      result: {
        replacement: 'Second one.',
        rationale: 'Clearer.',
        unchanged: false,
      },
    })
  })

  it('maps the Block range through edits made elsewhere during the stream', () => {
    const changes = change(0, 0, 'Intro.\n\n')
    const placed = place(editOn(SECOND), {
      changes,
      doc: docAfter(changes),
    })
    expect(placed).toMatchObject({
      type: 'placed',
      draft: { from: SECOND.from + 8, to: SECOND.to + 8 },
    })
  })

  it('maps through an edit after the Block too', () => {
    const changes = change(THIRD.to, THIRD.to, ' More.')
    const placed = place(editOn(SECOND), { changes, doc: docAfter(changes) })
    expect(placed).toMatchObject({
      type: 'placed',
      draft: { from: SECOND.from, to: SECOND.to },
    })
  })

  it('drops the edit when the user edited inside its Block', () => {
    const changes = change(SECOND.from + 3, SECOND.from + 3, 'zz')
    expect(place(editOn(SECOND), { changes, doc: docAfter(changes) })).toEqual({
      type: 'dropped',
      reason: 'text-changed',
    })
  })

  it('drops the edit when the mapped text no longer matches the Block', () => {
    expect(
      place(editOn(SECOND), { doc: DOC.replace('Second', 'Sekond') }),
    ).toEqual({ type: 'dropped', reason: 'text-changed' })
  })

  it('drops the edit when a Suggestion now overlaps the mapped Block', () => {
    const state = stateOf(draft('other', SECOND.from + 2, SECOND.from + 6))
    expect(place(editOn(SECOND), { state })).toEqual({
      type: 'dropped',
      reason: 'occupied',
    })
  })

  it('drops the edit when a pending Suggestion covers the Block', () => {
    const state = stateOf(draft('other', SECOND.from, SECOND.to))
    expect(place(editOn(SECOND), { state })).toMatchObject({
      type: 'dropped',
      reason: 'occupied',
    })
  })

  it('places the edit next to Suggestions on other Blocks', () => {
    const state = stateOf(
      draft('a', FIRST.from, FIRST.to),
      draft('c', THIRD.from, THIRD.to),
    )
    expect(place(editOn(SECOND), { state }).type).toBe('placed')
  })

  it('checks the user edit before the overlap', () => {
    const changes = change(SECOND.from + 3, SECOND.from + 3, 'zz')
    const state = stateOf(draft('other', SECOND.from, SECOND.to))
    expect(
      place(editOn(SECOND), { state, changes, doc: docAfter(changes) }),
    ).toMatchObject({ reason: 'text-changed' })
  })

  it('yields a Suggestion state with the review origin once applied', () => {
    const placed = place(editOn(FIRST, 'First.'))
    if (placed.type !== 'placed') throw new Error('expected a placement')
    const state = resolveSuggestion(
      beginSuggestion(emptySuggestions, placed.draft),
      placed.draft.id,
      placed.result,
    )
    expect(findSuggestion(state, 's1')).toMatchObject({
      status: 'ready',
      origin: 'review',
      replacement: 'First.',
    })
  })
})

describe('Accept all and Reject all scope', () => {
  const reviewState = () => {
    const state = stateOf(
      draft('ask', FIRST.from, FIRST.to),
      draft('r2', THIRD.from, THIRD.to, { origin: 'review' }),
      draft('r1', SECOND.from, SECOND.to, { origin: 'review' }),
    )
    return readyOf(
      readyOf(readyOf(state, 'ask', 'Asked.'), 'r2', 'Three.'),
      'r1',
      'Two.',
    )
  }

  it('counts the open review Suggestions', () => {
    expect(openReviewCount(reviewState())).toBe(2)
    expect(openReviewCount(emptySuggestions)).toBe(0)
  })

  it('ignores review Suggestions that are not ready', () => {
    const state = stateOf(
      draft('r', SECOND.from, SECOND.to, { origin: 'review' }),
    )
    expect(openReviewCount(state)).toBe(0)
    expect(acceptAllPlan(state)).toEqual({ ids: [], changes: [] })
  })

  it('plans one change per ready review Suggestion, in document order', () => {
    expect(acceptAllPlan(reviewState())).toEqual({
      ids: ['r1', 'r2'],
      changes: [
        { from: SECOND.from, to: SECOND.to, insert: 'Two.' },
        { from: THIRD.from, to: THIRD.to, insert: 'Three.' },
      ],
    })
  })

  it('plans changes that apply together to the original Document', () => {
    const { changes } = acceptAllPlan(reviewState())
    const applied = docAfter(ChangeSet.of([...changes], DOC.length))
    expect(applied).toContain('Two.')
    expect(applied).toContain('Three.')
    expect(applied).toContain('First paragraph here.')
    expect(applied).not.toContain('Second paragraph')
  })
})

describe('reviewSummary', () => {
  it('says how many Suggestions the pass produced', () => {
    expect(reviewSummary({ added: 4, stopped: false })).toBe(
      'Review: 4 suggestions',
    )
    expect(reviewSummary({ added: 1, stopped: false })).toBe(
      'Review: 1 suggestion',
    )
    expect(reviewSummary({ added: 0, stopped: false })).toBe(
      'Review: no suggestions',
    )
  })

  it('says when the user stopped the pass', () => {
    expect(reviewSummary({ added: 2, stopped: true })).toBe(
      'Review stopped: 2 suggestions',
    )
    expect(reviewSummary({ added: 0, stopped: true })).toBe(
      'Review stopped: no suggestions',
    )
  })
})

describe('reviewTaskLabel', () => {
  it('names the Focus, or the default criteria', () => {
    expect(reviewTaskLabel('tone only')).toBe(
      'review document → focus: tone only',
    )
    expect(reviewTaskLabel('  ')).toBe('review document → default criteria')
  })
})

describe('reviewNoticeText', () => {
  it('summarises a clean pass', () => {
    expect(reviewNoticeText({ added: 4 })).toBe('Review: 4 suggestions')
    expect(reviewNoticeText({ added: 0 })).toBe('Review: no suggestions')
  })

  it('gives the human message when the error came before any Suggestion', () => {
    expect(
      reviewNoticeText({
        added: 0,
        error: { type: 'out-of-credit', message: 'No credit' },
      }),
    ).toMatch(/out of credit/i)
  })

  it('keeps the count and adds the message when the error came after some', () => {
    const text = reviewNoticeText({
      added: 2,
      error: { type: 'timeout', message: 'slow' },
    })
    expect(text).toContain('Review: 2 suggestions')
    expect(text).toMatch(/took too long/i)
  })
})
