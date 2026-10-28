import { describe, expect, it, vi } from 'vitest'
import type { TargetRequest } from './client'
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

const answer: Result<SuggestionResult> = {
  ok: true,
  value: { replacement: 'Hi', rationale: 'Shorter.', unchanged: false },
}

describe('createLazyModelClient', () => {
  it('loads the client on the first request and reuses it', async () => {
    const requestSuggestion = vi.fn(async () => answer)
    const load = vi.fn(async () => ({ requestSuggestion }))
    const client = createLazyModelClient(load)

    expect(load).not.toHaveBeenCalled()
    expect(await client.requestSuggestion(request)).toBe(answer)
    expect(await client.requestSuggestion(request)).toBe(answer)

    expect(load).toHaveBeenCalledTimes(1)
    expect(requestSuggestion).toHaveBeenCalledWith(request)
  })

  it('shares one load between concurrent requests', async () => {
    const load = vi.fn(async () => ({ requestSuggestion: async () => answer }))
    const client = createLazyModelClient(load)

    await Promise.all([
      client.requestSuggestion(request),
      client.requestSuggestion(request),
    ])

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('turns a failed load into a network error and tries again next time', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(
        new TypeError('Failed to fetch dynamically imported module'),
      )
      .mockResolvedValue({ requestSuggestion: async () => answer })
    const client = createLazyModelClient(load)

    const failed = await client.requestSuggestion(request)
    expect(failed).toMatchObject({ ok: false, error: { type: 'network' } })

    expect(await client.requestSuggestion(request)).toBe(answer)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
