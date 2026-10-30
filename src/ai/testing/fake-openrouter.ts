export type FakeRequest = {
  readonly url: string
  readonly method: string
  readonly headers: Headers
  readonly body: unknown
}

export type FakeHandler = (
  request: FakeRequest,
  signal: AbortSignal | undefined,
) => Response | Promise<Response>

export type FakeOpenRouter = {
  readonly fetch: typeof fetch
  readonly requests: readonly FakeRequest[]
  readonly chatRequests: () => readonly FakeRequest[]
}

export type Usage = {
  readonly prompt_tokens: number
  readonly completion_tokens: number
  readonly total_tokens: number
  readonly cost?: number
  readonly completion_tokens_details?: { readonly reasoning_tokens: number }
  readonly prompt_tokens_details?: { readonly cached_tokens: number }
}

export const usage = (overrides: Partial<Usage> = {}): Usage => ({
  prompt_tokens: 120,
  completion_tokens: 40,
  total_tokens: 160,
  cost: 0.0002,
  completion_tokens_details: { reasoning_tokens: 4 },
  prompt_tokens_details: { cached_tokens: 0 },
  ...overrides,
})

const JSON_HEADERS = { 'content-type': 'application/json' }

export const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const errorResponse = (status: number, message: string): Response =>
  jsonResponse(status, { error: { code: status, message } })

type CompletionOptions = {
  readonly id?: string
  readonly model?: string
  readonly provider?: string
  readonly usage?: Usage
  readonly finishReason?: string
}

type StreamOptions = CompletionOptions & {
  readonly chunkSize?: number
  readonly delayMs?: number
  readonly stallAfter?: number
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const chatStream = (
  content: string,
  {
    id = 'gen-test-1',
    model = 'vendor/model-served',
    provider = 'Acme',
    usage: usageOverride = usage(),
    finishReason = 'stop',
    chunkSize = 24,
    delayMs = 0,
    stallAfter,
  }: StreamOptions = {},
): Response => {
  const encoder = new TextEncoder()
  const pieces =
    content.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, 'g')) ?? []
  const chunks: readonly unknown[] = [
    ...pieces.map((piece) => ({
      id,
      model,
      provider,
      choices: [{ delta: { role: 'assistant', content: piece } }],
    })),
    {
      id,
      model,
      provider,
      choices: [{ delta: {}, finish_reason: finishReason }],
      usage: usageOverride,
    },
  ]
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const [index, chunk] of chunks.entries()) {
          if (index === stallAfter) return
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          )
          if (delayMs > 0) await sleep(delayMs)
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
}

export const generationResponse = (
  overrides: Record<string, unknown> = {},
): Response =>
  jsonResponse(200, {
    data: {
      id: 'gen-test-1',
      model: 'vendor/model-served',
      provider_name: 'Acme',
      latency: 900,
      generation_time: 700,
      finish_reason: 'stop',
      tokens_prompt: 120,
      tokens_completion: 40,
      native_tokens_reasoning: 4,
      native_tokens_cached: 0,
      total_cost: 0.0002,
      ...overrides,
    },
  })

export const hangUntilAborted: FakeHandler = (_request, signal) =>
  new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason))
  })

export const createFakeOpenRouter = ({
  chat,
  generation = () => errorResponse(404, 'not found'),
}: {
  readonly chat: readonly FakeHandler[]
  readonly generation?: FakeHandler
}): FakeOpenRouter => {
  const requests: FakeRequest[] = []
  let chatCalls = 0
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input)
    const text = typeof init?.body === 'string' ? init.body : undefined
    const request: FakeRequest = {
      url,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: text === undefined ? undefined : JSON.parse(text),
    }
    requests.push(request)
    const signal = init?.signal ?? undefined
    if (url.includes('/chat/completions')) {
      const handler = chat[Math.min(chatCalls, chat.length - 1)]
      chatCalls += 1
      if (!handler) throw new Error('no chat handler configured')
      return handler(request, signal)
    }
    if (url.includes('/generation')) return generation(request, signal)
    return errorResponse(404, `unexpected url ${url}`)
  }
  return {
    fetch: fakeFetch,
    requests,
    chatRequests: () =>
      requests.filter((request) => request.url.includes('/chat/completions')),
  }
}
