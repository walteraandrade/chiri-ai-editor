import { describe, expect, it } from 'vitest'
import { newlyRevealedIds } from './moments'
import {
  beginRefine,
  beginSuggestion,
  emptySuggestions,
  rejectSuggestion,
  resolveRefine,
  resolveSuggestion,
  showVersion,
} from './state'
import type { Instruction, SuggestionDraft, SuggestionsState } from './types'

const SHORTER: Instruction = {
  type: 'quick-action',
  id: 'shorter',
  label: 'Shorter',
  text: 'Make it shorter.',
}

const draft = (id: string, from: number, to: number): SuggestionDraft => ({
  id,
  from,
  to,
  source: 'selection',
  original: 'x'.repeat(to - from),
  instruction: SHORTER,
})

const result = (replacement: string) => ({
  replacement,
  rationale: 'Because.',
  unchanged: false,
})

const pending = (id = 'a'): SuggestionsState =>
  beginSuggestion(emptySuggestions, draft(id, 0, 5))

const ready = (id = 'a'): SuggestionsState =>
  resolveSuggestion(pending(id), id, result('short'))

describe('newlyRevealedIds', () => {
  it('reveals a Suggestion when its Replacement arrives', () => {
    expect(newlyRevealedIds(pending(), ready())).toEqual(['a'])
  })

  it('reveals nothing when a ready Suggestion is unchanged', () => {
    const before = ready()
    const after = beginSuggestion(before, draft('b', 10, 15))
    expect(newlyRevealedIds(before, after)).toEqual([])
  })

  it('reveals nothing while a Refine is working', () => {
    const before = ready()
    expect(newlyRevealedIds(before, beginRefine(before, 'a', SHORTER))).toEqual(
      [],
    )
  })

  it('reveals a Suggestion when a Refine lands', () => {
    const before = beginRefine(ready(), 'a', SHORTER)
    expect(
      newlyRevealedIds(before, resolveRefine(before, 'a', result('tiny'))),
    ).toEqual(['a'])
  })

  it('reveals a Suggestion when another version is shown', () => {
    const refining = beginRefine(ready(), 'a', SHORTER)
    const before = resolveRefine(refining, 'a', result('tiny'))
    expect(newlyRevealedIds(before, showVersion(before, 'a', 0))).toEqual(['a'])
  })

  it('reveals only the Suggestion whose text changed', () => {
    const both = resolveSuggestion(
      beginSuggestion(ready('a'), draft('b', 10, 15)),
      'b',
      result('brief'),
    )
    const before = beginRefine(both, 'b', SHORTER)
    expect(
      newlyRevealedIds(before, resolveRefine(before, 'b', result('tiny'))),
    ).toEqual(['b'])
  })

  it('reveals nothing when a Suggestion goes away', () => {
    const before = ready()
    expect(newlyRevealedIds(before, rejectSuggestion(before, 'a'))).toEqual([])
  })
})
