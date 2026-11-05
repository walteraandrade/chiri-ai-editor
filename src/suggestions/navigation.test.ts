import { describe, expect, it } from 'vitest'
import { stepSuggestion } from './navigation'
import { beginSuggestion, emptySuggestions } from './state'
import type { SuggestionDraft } from './types'

const draft = (id: string, from: number, to: number): SuggestionDraft => ({
  id,
  from,
  to,
  source: 'block',
  original: 'x'.repeat(to - from),
  instruction: { type: 'free-text', text: 'go' },
})

const state = [
  draft('a', 0, 10),
  draft('b', 20, 30),
  draft('c', 40, 50),
].reduce(beginSuggestion, emptySuggestions)

describe('stepSuggestion', () => {
  it('goes to the next Suggestion in Document order', () => {
    expect(stepSuggestion(state, 5, 1)).toBe(20)
    expect(stepSuggestion(state, 25, 1)).toBe(40)
  })

  it('goes to the previous Suggestion', () => {
    expect(stepSuggestion(state, 45, -1)).toBe(20)
    expect(stepSuggestion(state, 25, -1)).toBe(0)
  })

  it('wraps at the ends', () => {
    expect(stepSuggestion(state, 45, 1)).toBe(0)
    expect(stepSuggestion(state, 5, -1)).toBe(40)
  })

  it('starts from the cursor outside any Suggestion', () => {
    expect(stepSuggestion(state, 15, 1)).toBe(20)
    expect(stepSuggestion(state, 15, -1)).toBe(0)
  })

  it('has nowhere to go without other Suggestions', () => {
    expect(stepSuggestion(emptySuggestions, 0, 1)).toBeUndefined()
    const single = beginSuggestion(emptySuggestions, draft('a', 0, 10))
    expect(stepSuggestion(single, 5, 1)).toBeUndefined()
  })
})
