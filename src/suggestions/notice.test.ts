import { describe, expect, it } from 'vitest'
import { noticeMessage } from './notice'

describe('noticeMessage', () => {
  it('words the Discard notice for edited text', () => {
    expect(noticeMessage('text-changed')).toBe(
      'Suggestion discarded: the text changed',
    )
  })

  it('words the Discard notice for a replaced Suggestion', () => {
    expect(noticeMessage('replaced')).toBe(
      'Suggestion discarded: replaced by your new request',
    )
  })

  it('words the notice for an unchanged Replacement', () => {
    expect(noticeMessage('no-change')).toBe('No change suggested')
  })
})
