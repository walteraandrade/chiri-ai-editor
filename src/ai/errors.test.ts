import { APICallError, NoObjectGeneratedError, RetryError } from 'ai'
import { describe, expect, it } from 'vitest'
import { classifyError, isRetryableOutputError } from './errors'

const apiError = (statusCode: number | undefined, data?: unknown) =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: 'http://localhost/api/openrouter/chat/completions',
    requestBodyValues: {},
    statusCode,
    data,
  })

const noObject = () =>
  new NoObjectGeneratedError({
    message: 'No object generated',
    response: { id: 'x', timestamp: new Date(), modelId: 'm' },
    usage: {
      inputTokens: 1,
      inputTokenDetails: {
        noCacheTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      outputTokens: 1,
      outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
      totalTokens: 2,
    },
    finishReason: 'stop',
  })

describe('classifyError', () => {
  it('maps 402 to out-of-credit', () => {
    expect(classifyError(apiError(402)).type).toBe('out-of-credit')
  })

  it('maps 429 to rate-limited', () => {
    expect(classifyError(apiError(429)).type).toBe('rate-limited')
  })

  it('maps other HTTP failures to api with the status', () => {
    expect(classifyError(apiError(500))).toMatchObject({
      type: 'api',
      status: 500,
    })
  })

  it('maps a failed connection to network', () => {
    expect(classifyError(apiError(undefined)).type).toBe('network')
  })

  it('reads the status from an error payload sent with HTTP 200', () => {
    expect(classifyError(apiError(200, { code: 402 })).type).toBe(
      'out-of-credit',
    )
    expect(classifyError(apiError(200, { code: 429 })).type).toBe(
      'rate-limited',
    )
  })

  it('maps a timeout to timeout', () => {
    const error = new DOMException('The operation timed out.', 'TimeoutError')
    expect(classifyError(error).type).toBe('timeout')
  })

  it('maps an abort to aborted', () => {
    const error = new DOMException('Aborted', 'AbortError')
    expect(classifyError(error).type).toBe('aborted')
  })

  it('maps a schema failure to invalid-output', () => {
    expect(classifyError(noObject()).type).toBe('invalid-output')
  })

  it('unwraps a RetryError to its last error', () => {
    const wrapped = new RetryError({
      message: 'failed after retries',
      reason: 'maxRetriesExceeded',
      errors: [apiError(500), apiError(429)],
    })
    expect(classifyError(wrapped).type).toBe('rate-limited')
  })

  it('finds a classified error in the cause chain', () => {
    const outer = new Error('wrapper', { cause: apiError(402) })
    expect(classifyError(outer).type).toBe('out-of-credit')
  })

  it('falls back to unknown with the message', () => {
    expect(classifyError(new Error('boom'))).toEqual({
      type: 'unknown',
      message: 'boom',
    })
    expect(classifyError('plain string').type).toBe('unknown')
  })
})

describe('isRetryableOutputError', () => {
  it('retries only invalid output', () => {
    expect(
      isRetryableOutputError({ type: 'invalid-output', message: 'x' }),
    ).toBe(true)
    expect(isRetryableOutputError({ type: 'timeout', message: 'x' })).toBe(
      false,
    )
    expect(
      isRetryableOutputError({ type: 'out-of-credit', message: 'x' }),
    ).toBe(false)
  })
})
