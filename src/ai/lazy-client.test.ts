import { describe, expect, it, vi } from 'vitest'
import type { RefineRequest, TargetRequest } from './client'
import type { SuggestionResult } from './edits'
import type { Result } from './errors'
import { createLazyModelClient } from './lazy-client'

const request = {
  target: {
    source: 'block',
    from: 0,
    to: 5,
    text: 'Hello',
    blocks: [],
  },
  neighbors: { before: [], after: [] },
  instruction: 'Shorter',
} satisfies TargetRequest

const refineRequest = {
  ...request,
  history: ['Shorter'],
  latestReplacement: 'Hi',
} satisfies RefineRequest

const answer: Result<SuggestionResult> = {
  ok: true,
  value: { replacement: 'Hi', rationale: 'Shorter.', unchanged: false },
}

describe('createLazyModelClient', () => {
  it('loads the client on the first request and reuses it', async () => {
    const requestSuggestion = vi.fn(async () => answer)
    const load = vi.fn(async () => ({
      requestSuggestion,
      refineSuggestion: async () => answer,
    }))
    const client = createLazyModelClient(load)

    expect(load).not.toHaveBeenCalled()
    expect(await client.requestSuggestion(request)).toBe(answer)
    expect(await client.requestSuggestion(request)).toBe(answer)

    expect(load).toHaveBeenCalledTimes(1)
    expect(requestSuggestion).toHaveBeenCalledWith(request)
  })

  it('shares one load between concurrent requests', async () => {
    const load = vi.fn(async () => ({
      requestSuggestion: async () => answer,
      refineSuggestion: async () => answer,
    }))
    const client = createLazyModelClient(load)

    await Promise.all([
      client.requestSuggestion(request),
      client.requestSuggestion(request),
    ])

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('turns a failed load into an unknown error that says to reload, and tries again next time', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(
        new TypeError('Failed to fetch dynamically imported module'),
      )
      .mockResolvedValue({
        requestSuggestion: async () => answer,
        refineSuggestion: async () => answer,
      })
    const client = createLazyModelClient(load)

    const failed = await client.requestSuggestion(request)
    expect(failed).toMatchObject({ ok: false, error: { type: 'unknown' } })
    expect(!failed.ok && failed.error.message).toMatch(/reload the page/i)

    expect(await client.requestSuggestion(request)).toBe(answer)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('loads the client for a Refine and forwards the request', async () => {
    const refineSuggestion = vi.fn(async () => answer)
    const load = vi.fn(async () => ({
      requestSuggestion: async () => answer,
      refineSuggestion,
    }))
    const client = createLazyModelClient(load)

    expect(await client.refineSuggestion(refineRequest)).toBe(answer)

    expect(load).toHaveBeenCalledTimes(1)
    expect(refineSuggestion).toHaveBeenCalledWith(refineRequest)
  })

  it('turns a failed load into the reload error for a Refine too', async () => {
    const load = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createLazyModelClient(load)

    const failed = await client.refineSuggestion(refineRequest)

    expect(failed).toMatchObject({ ok: false, error: { type: 'unknown' } })
    expect(!failed.ok && failed.error.message).toMatch(/reload the page/i)
  })
})
