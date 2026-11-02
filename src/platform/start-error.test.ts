import { describe, expect, it } from 'vitest'
import { startErrorMessage } from './start-error'

describe('startErrorMessage', () => {
  it('uses the message of an Error', () => {
    expect(startErrorMessage(new Error('main process unavailable'))).toBe(
      'main process unavailable',
    )
  })

  it('falls back when there is nothing to show', () => {
    expect(startErrorMessage(new Error('  '))).toBe('Unknown error')
    expect(startErrorMessage('boom')).toBe('Unknown error')
    expect(startErrorMessage(undefined)).toBe('Unknown error')
  })
})
