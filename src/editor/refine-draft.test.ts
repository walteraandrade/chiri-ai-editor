import { describe, expect, it } from 'vitest'
import { restorableDraft } from './refine-draft'

const draft = { owner: 'a', value: 'make it shor', focused: true }

describe('restorableDraft', () => {
  it('gives back the draft for the Suggestion whose input is open', () => {
    expect(restorableDraft(draft, 'a')).toBe(draft)
  })

  it('drops the draft when another Suggestion or none owns the input', () => {
    expect(restorableDraft(draft, 'b')).toBeNull()
    expect(restorableDraft(draft, null)).toBeNull()
    expect(restorableDraft(undefined, 'a')).toBeNull()
  })
})
