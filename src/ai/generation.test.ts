import { describe, expect, it } from 'vitest'
import { fetchGeneration } from './generation'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const scripted = (responses: readonly Response[]) => {
  const calls: { url: string; headers: Headers }[] = []
  let index = 0
  const fetchStub: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) })
    const response = responses[Math.min(index, responses.length - 1)]
    index += 1
    if (!response) throw new Error('no scripted response')
    return response.clone()
  }
  return { fetchStub, calls }
}

const noSleep = () => {
  const delays: number[] = []
  return {
    sleep: async (ms: number) => {
      delays.push(ms)
    },
    delays,
  }
}

const GENERATION = {
  id: 'gen-1',
  model: 'vendor/model-a',
  provider_name: 'Acme',
  latency: 1200,
  generation_time: 1000,
  finish_reason: 'stop',
  tokens_prompt: 10,
  tokens_completion: 5,
  native_tokens_reasoning: 0,
  native_tokens_cached: 0,
  total_cost: 0.0001,
}

describe('fetchGeneration', () => {
  it('requests the generation by id with the Authorization header', async () => {
    const { fetchStub, calls } = scripted([json(200, { data: GENERATION })])
    const { sleep } = noSleep()
    const generation = await fetchGeneration({
      baseURL: 'http://localhost/api/openrouter',
      apiKey: 'placeholder',
      fetch: fetchStub,
      id: 'gen-1',
      sleep,
    })
    expect(generation).toMatchObject({ id: 'gen-1', provider_name: 'Acme' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(
      'http://localhost/api/openrouter/generation?id=gen-1',
    )
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer placeholder')
  })

  it('retries a 404 with backoff until the generation shows up', async () => {
    const { fetchStub, calls } = scripted([
      json(404, { error: { code: 404, message: 'not found' } }),
      json(404, { error: { code: 404, message: 'not found' } }),
      json(200, { data: GENERATION }),
    ])
    const { sleep, delays } = noSleep()
    const generation = await fetchGeneration({
      baseURL: 'http://localhost/api/openrouter',
      apiKey: 'k',
      fetch: fetchStub,
      id: 'gen-1',
      sleep,
      delaysMs: [100, 200, 400],
    })
    expect(generation?.id).toBe('gen-1')
    expect(calls).toHaveLength(3)
    expect(delays).toEqual([100, 200])
  })

  it('gives up after the last delay', async () => {
    const { fetchStub, calls } = scripted([json(404, { error: {} })])
    const { sleep, delays } = noSleep()
    const generation = await fetchGeneration({
      baseURL: 'http://localhost/api/openrouter',
      apiKey: 'k',
      fetch: fetchStub,
      id: 'gen-1',
      sleep,
      delaysMs: [10, 20],
    })
    expect(generation).toBeUndefined()
    expect(calls).toHaveLength(3)
    expect(delays).toEqual([10, 20])
  })

  it('returns undefined when the body is not a generation', async () => {
    const { fetchStub } = scripted([json(200, { data: 'nope' })])
    const generation = await fetchGeneration({
      baseURL: 'http://localhost/api/openrouter',
      apiKey: 'k',
      fetch: fetchStub,
      id: 'gen-1',
      sleep: noSleep().sleep,
      delaysMs: [],
    })
    expect(generation).toBeUndefined()
  })

  it('returns undefined when the network fails', async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError('fetch failed')
    }
    const generation = await fetchGeneration({
      baseURL: 'http://localhost/api/openrouter',
      apiKey: 'k',
      fetch: failing,
      id: 'gen-1',
      sleep: noSleep().sleep,
      delaysMs: [1],
    })
    expect(generation).toBeUndefined()
  })

  it('does not call the endpoint without a generation id', async () => {
    const { fetchStub, calls } = scripted([json(200, { data: GENERATION })])
    const generation = await fetchGeneration({
      baseURL: 'http://localhost/api/openrouter',
      apiKey: 'k',
      fetch: fetchStub,
      id: undefined,
      sleep: noSleep().sleep,
    })
    expect(generation).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
