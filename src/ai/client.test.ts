import { describe, expect, it } from 'vitest'
import { extractBlocks } from '../blocks/extract-blocks'
import { getNeighbors, resolveTarget } from '../blocks/target'
import {
  createModelClient,
  type ModelClientConfig,
  type ReviewEvent,
} from './client'
import type { AiCallRecord } from './records'
import {
  chatCompletion,
  chatStream,
  createFakeOpenRouter,
  errorResponse,
  type FakeHandler,
  generationResponse,
  hangUntilAborted,
  usage,
} from './testing/fake-openrouter'

const DOC =
  '# Guide\n\nFirst paragraph here.\n\nSecond paragraph is a bit longer.\n\n```js\nconst a = 1\n```\n\nFourth one.\n'
const blocks = extractBlocks(DOC)

const targetRequest = (instruction = 'Make it shorter.') => {
  const from = DOC.indexOf('Second')
  const target = resolveTarget(blocks, DOC, { from, to: from })
  if (!target) throw new Error('no target')
  return { target, neighbors: getNeighbors(blocks, target), instruction }
}

const suggestionJson = (replacement: string, rationale = 'Tighter.') =>
  JSON.stringify({ replacement, rationale })

const setup = (
  chat: readonly FakeHandler[],
  overrides: Partial<ModelClientConfig> = {},
  generation?: FakeHandler,
) => {
  const fake = createFakeOpenRouter({ chat, generation })
  const records: AiCallRecord[] = []
  const enriched: AiCallRecord[] = []
  const client = createModelClient({
    baseURL: 'http://localhost/api/openrouter',
    apiKey: 'placeholder',
    model: 'vendor/model-a',
    fetch: fake.fetch,
    maxRetries: 0,
    generationInitialDelayMs: 0,
    generationDelaysMs: [],
    onRecord: (record) => records.push(record),
    onRecordEnriched: (record) => enriched.push(record),
    ...overrides,
  })
  return { fake, client, records, enriched }
}

const collect = async (events: AsyncIterable<ReviewEvent>) => {
  const all: ReviewEvent[] = []
  for await (const event of events) all.push(event)
  return all
}

describe('request body', () => {
  it('sends a strict JSON schema with require_parameters for Target requests', async () => {
    const { fake, client } = setup([
      () => chatCompletion(suggestionJson('Short.')),
    ])
    await client.requestSuggestion(targetRequest())
    const [request] = fake.chatRequests()
    expect(request?.url).toBe(
      'http://localhost/api/openrouter/chat/completions',
    )
    expect(request?.headers.get('authorization')).toBe('Bearer placeholder')
    expect(request?.body).toMatchObject({
      model: 'vendor/model-a',
      response_format: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: {
            type: 'object',
            required: ['replacement', 'rationale'],
            additionalProperties: false,
          },
        },
      },
      provider: { require_parameters: true },
      reasoning: { effort: 'low' },
    })
    expect(request?.body).not.toHaveProperty('stream')
  })

  it('sends the array wrapper as a strict JSON schema for the Review pass', async () => {
    const { fake, client } = setup([
      () => chatStream(JSON.stringify({ elements: [] })),
    ])
    await collect(client.reviewDocument({ blocks }))
    const [request] = fake.chatRequests()
    expect(request?.body).toMatchObject({
      stream: true,
      response_format: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: {
            type: 'object',
            required: ['elements'],
            additionalProperties: false,
            properties: {
              elements: {
                type: 'array',
                items: {
                  required: ['blockId', 'replacement', 'rationale'],
                  additionalProperties: false,
                },
              },
            },
          },
        },
      },
      provider: { require_parameters: true },
      reasoning: { effort: 'low' },
    })
  })

  it('can leave reasoning at the model default', async () => {
    const { fake, client } = setup(
      [() => chatCompletion(suggestionJson('Short.'))],
      { reasoning: 'default' },
    )
    await client.requestSuggestion(targetRequest())
    expect(fake.chatRequests()[0]?.body).not.toHaveProperty('reasoning')
  })

  it('puts the fixed rules and the Instruction in the messages', async () => {
    const { fake, client } = setup([
      () => chatCompletion(suggestionJson('Short.')),
    ])
    await client.requestSuggestion(targetRequest('Make it shorter.'))
    const body = fake.chatRequests()[0]?.body as { messages: unknown[] }
    const text = JSON.stringify(body.messages)
    expect(text).toContain('Do not invent facts')
    expect(text).toContain('Make it shorter.')
    expect(text).toContain('Second paragraph is a bit longer.')
  })
})

describe('requestSuggestion', () => {
  it('returns the validated Suggestion', async () => {
    const { client } = setup([() => chatCompletion(suggestionJson('Short.'))])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toEqual({
      ok: true,
      value: { replacement: 'Short.', rationale: 'Tighter.', unchanged: false },
    })
  })

  it('flags a Replacement equal to the original', async () => {
    const { client } = setup([
      () => chatCompletion(suggestionJson('Second paragraph is a bit longer.')),
    ])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({ ok: true, value: { unchanged: true } })
  })

  it('retries once silently on invalid output', async () => {
    const { fake, client, records } = setup([
      () => chatCompletion('{"replacement": 5}', { id: 'gen-a' }),
      () => chatCompletion(suggestionJson('Short.'), { id: 'gen-b' }),
    ])
    const result = await client.requestSuggestion(targetRequest())
    await client.flush()
    expect(result.ok).toBe(true)
    expect(fake.chatRequests()).toHaveLength(2)
    expect(
      records.map(({ attempt, outcome, generationId }) => ({
        attempt,
        outcome,
        generationId,
      })),
    ).toEqual([
      { attempt: 1, outcome: 'invalid', generationId: 'gen-a' },
      { attempt: 2, outcome: 'valid', generationId: 'gen-b' },
    ])
  })

  it('treats an empty Replacement as invalid output', async () => {
    const { fake, client } = setup([
      () => chatCompletion(suggestionJson('  ')),
      () => chatCompletion(suggestionJson('Short.')),
    ])
    const result = await client.requestSuggestion(targetRequest())
    expect(result.ok).toBe(true)
    expect(fake.chatRequests()).toHaveLength(2)
  })

  it('fails with invalid-output after the retry also fails', async () => {
    const { fake, client } = setup([() => chatCompletion('not json at all')])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({
      ok: false,
      error: { type: 'invalid-output' },
    })
    expect(fake.chatRequests()).toHaveLength(2)
  })

  it('surfaces 402 as out-of-credit without retrying', async () => {
    const { fake, client } = setup([
      () => errorResponse(402, 'Insufficient credits'),
    ])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({
      ok: false,
      error: { type: 'out-of-credit' },
    })
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('surfaces 429 as rate-limited', async () => {
    const { client } = setup([() => errorResponse(429, 'Slow down')])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({ ok: false, error: { type: 'rate-limited' } })
  })

  it('surfaces a failed connection as network', async () => {
    const { client } = setup([
      () => {
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('connect ECONNREFUSED'), {
            code: 'ECONNREFUSED',
          }),
        })
      },
    ])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({ ok: false, error: { type: 'network' } })
  })

  it('surfaces other HTTP failures as api errors with the status', async () => {
    const { client } = setup([() => errorResponse(400, 'Bad request')])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({
      ok: false,
      error: { type: 'api', status: 400 },
    })
  })

  it('times out without retrying', async () => {
    const { fake, client } = setup([hangUntilAborted], {
      timeoutsMs: { target: 60, review: 60 },
    })
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({ ok: false, error: { type: 'timeout' } })
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('lets SDK-level retries absorb a transient failure', async () => {
    const { fake, client } = setup(
      [
        () => errorResponse(503, 'Unavailable'),
        () => chatCompletion(suggestionJson('Short.')),
      ],
      { maxRetries: 1 },
    )
    const result = await client.requestSuggestion(targetRequest())
    expect(result.ok).toBe(true)
    expect(fake.chatRequests()).toHaveLength(2)
  }, 10_000)
})

describe('shared deadline', () => {
  const withClock = (
    chat: (advance: (ms: number) => void) => readonly FakeHandler[],
    timeoutMs = 400,
  ) => {
    let now = 0
    const advance = (ms: number) => {
      now += ms
    }
    return setup(chat(advance), {
      clock: () => now,
      timeoutsMs: { target: timeoutMs, review: timeoutMs },
    })
  }

  const slowInvalid =
    (advance: (ms: number) => void, ms: number): FakeHandler =>
    () => {
      advance(ms)
      return chatCompletion('not json at all')
    }

  const slowInvalidStream =
    (advance: (ms: number) => void, ms: number): FakeHandler =>
    () => {
      advance(ms)
      return chatStream('not json at all')
    }

  it('does not retry a Target request once the deadline has passed', async () => {
    const { fake, client } = withClock((advance) => [
      slowInvalid(advance, 400),
      () => chatCompletion(suggestionJson('Short.')),
    ])
    const result = await client.requestSuggestion(targetRequest())
    expect(result).toMatchObject({ ok: false, error: { type: 'timeout' } })
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('gives the retry only the time that is left', async () => {
    const { fake, client } = withClock((advance) => [
      slowInvalid(advance, 300),
      hangUntilAborted,
    ])
    const started = performance.now()
    const result = await client.requestSuggestion(targetRequest())
    const elapsed = performance.now() - started
    expect(result).toMatchObject({ ok: false, error: { type: 'timeout' } })
    expect(fake.chatRequests()).toHaveLength(2)
    expect(elapsed).toBeLessThan(300)
  })

  it('shares the deadline across Refine and its retry', async () => {
    const { fake, client } = withClock((advance) => [
      slowInvalid(advance, 400),
      () => chatCompletion(suggestionJson('Short.')),
    ])
    const result = await client.refineSuggestion({
      ...targetRequest('Warmer.'),
      history: [],
      latestReplacement: 'Short.',
    })
    expect(result).toMatchObject({ ok: false, error: { type: 'timeout' } })
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('does not retry a Review pass once the deadline has passed', async () => {
    const { fake, client } = withClock((advance) => [
      slowInvalidStream(advance, 400),
      () =>
        chatStream(reviewContent([{ blockId: 'p3', replacement: 'Short.' }])),
    ])
    const events = await collect(client.reviewDocument({ blocks }))
    expect(events).toEqual([
      { type: 'error', error: expect.objectContaining({ type: 'timeout' }) },
    ])
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('gives the Review retry only the time that is left', async () => {
    const { fake, client } = withClock((advance) => [
      slowInvalidStream(advance, 300),
      hangUntilAborted,
    ])
    const started = performance.now()
    const events = await collect(client.reviewDocument({ blocks }))
    const elapsed = performance.now() - started
    expect(events).toEqual([
      { type: 'error', error: expect.objectContaining({ type: 'timeout' }) },
    ])
    expect(fake.chatRequests()).toHaveLength(2)
    expect(elapsed).toBeLessThan(300)
  })
})

describe('refineSuggestion', () => {
  it('sends the history and the latest Replacement', async () => {
    const { fake, client } = setup([
      () => chatCompletion(suggestionJson('Tiny.')),
    ])
    const result = await client.refineSuggestion({
      ...targetRequest('Warmer.'),
      history: ['Make it shorter.'],
      latestReplacement: 'Short.',
    })
    expect(result.ok).toBe(true)
    const text = JSON.stringify(fake.chatRequests()[0]?.body)
    expect(text).toContain('Make it shorter.')
    expect(text).toContain('latest-replacement')
    expect(text).toContain('Warmer.')
  })
})

describe('AI call records', () => {
  it('records the call right away from telemetry', async () => {
    const { client, records, enriched } = setup([
      () =>
        chatCompletion(suggestionJson('Short.'), {
          id: 'gen-rec',
          usage: usage({
            prompt_tokens: 300,
            completion_tokens: 50,
            total_tokens: 350,
            cost: 0.00123,
            completion_tokens_details: { reasoning_tokens: 7 },
            prompt_tokens_details: { cached_tokens: 11 },
          }),
        }),
    ])
    await client.requestSuggestion({
      ...targetRequest(),
      task: 'select paragraph 2 → Shorter',
    })
    await client.recorded()
    expect(enriched).toEqual([])
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record).toMatchObject({
      task: 'select paragraph 2 → Shorter',
      attempt: 1,
      outcome: 'valid',
      requestedModel: 'vendor/model-a',
      servedModel: 'vendor/model-served',
      provider: 'Acme',
      tokens: { input: 300, output: 50, reasoning: 7, cached: 11 },
      costUsd: 0.00123,
      finishReason: 'stop',
      generationId: 'gen-rec',
      error: null,
    })
    expect(record?.latencyMs.openRouter).toBeNull()
    expect(record?.latencyMs.client).toBeGreaterThanOrEqual(0)
  })

  it('enriches the record with the generation endpoint later', async () => {
    const { client, enriched } = setup(
      [() => chatCompletion(suggestionJson('Short.'), { id: 'gen-rec' })],
      {},
      () =>
        generationResponse({
          id: 'gen-rec',
          provider_name: 'Parasail',
          latency: 800,
          generation_time: 650,
        }),
    )
    await client.requestSuggestion(targetRequest())
    await client.flush()
    expect(enriched).toHaveLength(1)
    expect(enriched[0]).toMatchObject({
      provider: 'Parasail',
      generationId: 'gen-rec',
    })
    expect(enriched[0]?.latencyMs.openRouter).toBe(800)
    expect(enriched[0]?.latencyMs.generation).toBe(650)
  })

  it('asks the generation endpoint with the response id', async () => {
    const { fake, client } = setup(
      [() => chatCompletion(suggestionJson('Short.'), { id: 'gen-xyz' })],
      {},
      () => generationResponse({ id: 'gen-xyz' }),
    )
    await client.requestSuggestion(targetRequest())
    await client.flush()
    const generationCall = fake.requests.find((request) =>
      request.url.includes('/generation'),
    )
    expect(generationCall?.url).toBe(
      'http://localhost/api/openrouter/generation?id=gen-xyz',
    )
  })

  it('does not poll the generation endpoint when nobody listens', async () => {
    const { fake, client } = setup(
      [() => chatCompletion(suggestionJson('Short.'))],
      { onRecordEnriched: undefined },
    )
    await client.requestSuggestion(targetRequest())
    await client.flush()
    expect(
      fake.requests.some((request) => request.url.includes('/generation')),
    ).toBe(false)
  })

  it('keeps the preliminary record when the generation endpoint has nothing', async () => {
    const { client, records, enriched } = setup([
      () => chatCompletion(suggestionJson('Short.'), { id: 'gen-404' }),
    ])
    await client.requestSuggestion(targetRequest())
    await client.flush()
    expect(records).toHaveLength(1)
    expect(enriched).toEqual([])
  })

  it('survives a record callback that throws', async () => {
    const { client } = setup(
      [() => chatCompletion(suggestionJson('Short.'), { id: 'gen-x' })],
      {
        onRecord: () => {
          throw new Error('listener bug')
        },
      },
      () => generationResponse({ id: 'gen-x' }),
    )
    const result = await client.requestSuggestion(targetRequest())
    await expect(client.flush()).resolves.toBeUndefined()
    expect(result.ok).toBe(true)
  })

  it('records failed calls too', async () => {
    const { client, records } = setup([() => errorResponse(402, 'No credit')])
    await client.requestSuggestion(targetRequest())
    await client.flush()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ outcome: 'error', costUsd: null })
    expect(records[0]?.error).toBe('out-of-credit')
  })

  it('uses a default task label when none is given', async () => {
    const { client, records } = setup([
      () => chatCompletion(suggestionJson('Short.')),
    ])
    await client.requestSuggestion(targetRequest('Make it shorter.'))
    await client.flush()
    expect(records[0]?.task).toBe('Target request: Make it shorter.')
  })
})

const reviewContent = (
  edits: readonly {
    blockId: string
    replacement: string
    rationale?: string
  }[],
) =>
  JSON.stringify({
    elements: edits.map((edit) => ({ rationale: 'Better.', ...edit })),
  })

describe('reviewDocument', () => {
  it('streams validated edits one by one, then reports done', async () => {
    const content = reviewContent([
      { blockId: 'p3', replacement: 'Second, shorter.' },
      { blockId: 'p5', replacement: 'Fourth.' },
    ])
    const { client, records } = setup(
      [() => chatStream(content, { chunkSize: 30, delayMs: 5 })],
      {},
      () => generationResponse({}),
    )
    const events = await collect(client.reviewDocument({ blocks }))
    await client.flush()
    expect(events.map((event) => event.type)).toEqual(['edit', 'edit', 'done'])
    const [first, second, done] = events
    expect(first).toMatchObject({
      type: 'edit',
      edit: { blockId: 'p3', replacement: 'Second, shorter.' },
    })
    expect(first?.type === 'edit' && first.edit.block.text).toBe(
      'Second paragraph is a bit longer.',
    )
    expect(second).toMatchObject({ type: 'edit', edit: { blockId: 'p5' } })
    expect(done).toMatchObject({
      type: 'done',
      validated: 2,
      dropped: 0,
      attempts: 1,
      incomplete: false,
    })
    expect(records).toHaveLength(1)
    expect(records[0]?.outcome).toBe('valid')
    expect(records[0]?.latencyMs.firstSuggestion).not.toBeNull()
    expect(records[0]?.latencyMs.firstElement).not.toBeNull()
    expect(records[0]?.tokens.input).toBe(120)
  })

  it('emits the first edit before the stream has finished', async () => {
    const content = reviewContent([
      { blockId: 'p3', replacement: 'Second, shorter.' },
      { blockId: 'p5', replacement: 'Fourth.' },
    ])
    const { client } = setup([
      () => chatStream(content, { chunkSize: 20, delayMs: 15 }),
    ])
    const started = performance.now()
    const times: number[] = []
    for await (const event of client.reviewDocument({ blocks })) {
      times.push(performance.now() - started)
      if (event.type === 'done') break
    }
    const [first, , done] = times
    expect(first).toBeDefined()
    expect(done).toBeDefined()
    expect((first ?? 0) < (done ?? 0) - 20).toBe(true)
  })

  it('drops edits that fail the app checks and says why', async () => {
    const content = reviewContent([
      { blockId: 'p99', replacement: 'Ghost.' },
      { blockId: 'p3', replacement: 'Second paragraph is a bit longer.' },
      { blockId: 'p4', replacement: 'changed code' },
      { blockId: 'p5', replacement: 'Fourth.' },
    ])
    const { client } = setup([() => chatStream(content)])
    const events = await collect(client.reviewDocument({ blocks }))
    expect(
      events.flatMap((event) =>
        event.type === 'dropped' ? [event.reason] : [],
      ),
    ).toEqual(['unknown-block', 'unchanged', 'code-block'])
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      validated: 1,
      dropped: 3,
    })
  })

  it('skips occupied Blocks', async () => {
    const content = reviewContent([
      { blockId: 'p3', replacement: 'Second, shorter.' },
    ])
    const { client } = setup([() => chatStream(content)])
    const events = await collect(
      client.reviewDocument({ blocks, occupied: new Set(['p3']) }),
    )
    expect(events.map((event) => event.type)).toEqual(['dropped', 'done'])
  })

  it('caps the validated edits at 6', async () => {
    const doc = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}.`).join(
      '\n\n',
    )
    const many = extractBlocks(doc)
    const content = reviewContent(
      many.map((block) => ({
        blockId: block.id,
        replacement: `${block.text} Edited.`,
      })),
    )
    const { client } = setup([() => chatStream(content)])
    const events = await collect(client.reviewDocument({ blocks: many }))
    expect(events.filter((event) => event.type === 'edit')).toHaveLength(6)
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      validated: 6,
      dropped: 2,
    })
  })

  it('retries silently when the first attempt yields nothing valid', async () => {
    const good = reviewContent([{ blockId: 'p3', replacement: 'Short.' }])
    const { fake, client, records } = setup([
      () => chatStream('this is not json'),
      () => chatStream(good),
    ])
    const events = await collect(client.reviewDocument({ blocks }))
    await client.flush()
    expect(events.map((event) => event.type)).toEqual(['edit', 'done'])
    expect(events.at(-1)).toMatchObject({ attempts: 2 })
    expect(fake.chatRequests()).toHaveLength(2)
    expect(
      records.map(({ attempt, outcome }) => ({ attempt, outcome })),
    ).toEqual([
      { attempt: 1, outcome: 'invalid' },
      { attempt: 2, outcome: 'valid' },
    ])
  })

  it('reports invalid-output when the retry fails too', async () => {
    const { client } = setup([() => chatStream('still not json')])
    const events = await collect(client.reviewDocument({ blocks }))
    expect(events).toEqual([
      {
        type: 'error',
        error: expect.objectContaining({ type: 'invalid-output' }),
      },
    ])
  })

  it('surfaces 402 as out-of-credit', async () => {
    const { fake, client } = setup([() => errorResponse(402, 'No credit')])
    const events = await collect(client.reviewDocument({ blocks }))
    expect(events).toEqual([
      {
        type: 'error',
        error: expect.objectContaining({ type: 'out-of-credit' }),
      },
    ])
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('keeps delivered edits when the output is cut short', async () => {
    const complete = reviewContent([
      { blockId: 'p3', replacement: 'Second, shorter.' },
      { blockId: 'p5', replacement: 'Fourth.' },
    ])
    const truncated = complete.slice(0, complete.length - 40)
    const { fake, client } = setup([
      () => chatStream(truncated, { finishReason: 'length' }),
    ])
    const events = await collect(client.reviewDocument({ blocks }))
    expect(events.filter((event) => event.type === 'edit')).toHaveLength(1)
    expect(events.at(-1)).toMatchObject({ type: 'done', incomplete: true })
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('stops the request when the consumer stops iterating', async () => {
    const content = reviewContent([
      { blockId: 'p3', replacement: 'Second, shorter.' },
      { blockId: 'p5', replacement: 'Fourth.' },
    ])
    const { client, records } = setup([
      () => chatStream(content, { chunkSize: 10, delayMs: 20 }),
    ])
    for await (const event of client.reviewDocument({ blocks })) {
      if (event.type === 'edit') break
    }
    await client.flush()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ outcome: 'error', error: 'aborted' })
  })

  it('times out a Review pass without retrying', async () => {
    const { fake, client } = setup([hangUntilAborted], {
      timeoutsMs: { target: 60, review: 60 },
    })
    const events = await collect(client.reviewDocument({ blocks }))
    expect(events).toEqual([
      { type: 'error', error: expect.objectContaining({ type: 'timeout' }) },
    ])
    expect(fake.chatRequests()).toHaveLength(1)
  })

  it('reports aborted when the caller aborts', async () => {
    const { client } = setup([hangUntilAborted])
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 20)
    const events = await collect(
      client.reviewDocument({ blocks, signal: controller.signal }),
    )
    expect(events).toEqual([
      { type: 'error', error: expect.objectContaining({ type: 'aborted' }) },
    ])
  })
})
