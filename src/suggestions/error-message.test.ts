import { describe, expect, it } from 'vitest'
import type { ClientError } from '../ai/errors'
import { describeError } from './error-message'

const of = (error: ClientError): string => describeError(error)

describe('describeError', () => {
  it('gives out-of-credit its own message', () => {
    const message = of({
      type: 'out-of-credit',
      message: 'Insufficient credits',
    })
    expect(message).toMatch(/^OpenRouter is out of credit/)
  })

  it('describes rate limits, timeouts and network failures briefly', () => {
    expect(of({ type: 'rate-limited', message: '' })).toBe(
      'Too many requests. Wait a moment, then retry.',
    )
    expect(of({ type: 'timeout', message: '' })).toBe(
      'The model took too long to answer. Retry.',
    )
    expect(of({ type: 'network', message: '' })).toBe(
      'Could not reach the model. Check your connection, then retry.',
    )
  })

  it('explains an invalid output that survived the silent retry', () => {
    expect(of({ type: 'invalid-output', message: '' })).toBe(
      'The model returned an unusable answer twice. Retry, or rephrase the Instruction.',
    )
  })

  it('shows the status of other API errors', () => {
    expect(of({ type: 'api', status: 500, message: 'Boom' })).toBe(
      'The model request failed (500): Boom',
    )
  })

  it('falls back to the raw message for unknown errors', () => {
    expect(of({ type: 'unknown', message: 'Weird' })).toBe(
      'Something went wrong: Weird',
    )
  })

  it('describes an aborted request', () => {
    expect(of({ type: 'aborted', message: '' })).toBe(
      'The request was cancelled.',
    )
  })
})
