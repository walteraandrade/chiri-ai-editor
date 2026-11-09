import { describe, expect, it, vi } from 'vitest'
import {
  forwardToOpenRouter,
  isOpenRouterPath,
  openRouterTarget,
} from './openrouter-forward'

const KEY = 'sk-or-v1-dummy-for-tests'
const APP = 'app://desafinado'

type UpstreamCall = { readonly url: string; readonly init: RequestInit }

const upstream = (
  respond: () => Response = () =>
    new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
) => {
  const calls: UpstreamCall[] = []
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return respond()
    },
  ) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

const chat = (headers: Record<string, string> = {}, body = '{"model":"m"}') =>
  new Request(`${APP}/api/openrouter/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer browser-placeholder-key',
      'content-type': 'application/json',
      ...headers,
    },
    body,
  })

const headerOf = (call: UpstreamCall | undefined, name: string) =>
  new Headers(call?.init.headers).get(name)

describe('isOpenRouterPath', () => {
  it('matches the forwarded prefix only', () => {
    expect(isOpenRouterPath('/api/openrouter/chat/completions')).toBe(true)
    expect(isOpenRouterPath('/api/openrouter/')).toBe(true)
    expect(isOpenRouterPath('/api/openrouter')).toBe(false)
    expect(isOpenRouterPath('/electron.html')).toBe(false)
    expect(isOpenRouterPath('/api/openrouterx/chat')).toBe(false)
  })
})

describe('openRouterTarget', () => {
  it('maps chat completions onto the API base', () => {
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/completions`, 'POST'),
    ).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('keeps the query of a generation lookup', () => {
    expect(
      openRouterTarget(`${APP}/api/openrouter/generation?id=gen-1`, 'GET'),
    ).toBe('https://openrouter.ai/api/v1/generation?id=gen-1')
  })

  it('refuses paths the client does not use', () => {
    expect(openRouterTarget(`${APP}/api/openrouter/key`, 'GET')).toBeNull()
    expect(openRouterTarget(`${APP}/api/openrouter/credits`, 'GET')).toBeNull()
    expect(openRouterTarget(`${APP}/api/openrouter/`, 'GET')).toBeNull()
  })

  it('refuses another method for a known path', () => {
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/completions`, 'GET'),
    ).toBeNull()
    expect(
      openRouterTarget(`${APP}/api/openrouter/generation?id=a`, 'POST'),
    ).toBeNull()
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/completions`, 'DELETE'),
    ).toBeNull()
  })

  it('refuses traversal and look-alike paths', () => {
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/completions/..`, 'POST'),
    ).toBeNull()
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/%2e%2e/key`, 'GET'),
    ).toBeNull()
    expect(
      openRouterTarget(`${APP}/api/openrouter//chat/completions`, 'POST'),
    ).toBeNull()
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/completions%2f..`, 'POST'),
    ).toBeNull()
    expect(
      openRouterTarget(`${APP}/api/openrouter/chat/completions/`, 'POST'),
    ).toBeNull()
  })

  it('refuses a URL that does not parse', () => {
    expect(openRouterTarget('not a url', 'POST')).toBeNull()
  })
})

describe('forwardToOpenRouter', () => {
  it('overwrites Authorization with the stored key', async () => {
    const { fetch, calls } = upstream()
    await forwardToOpenRouter({ request: chat(), apiKey: KEY, fetch })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(headerOf(calls[0], 'authorization')).toBe(`Bearer ${KEY}`)
  })

  it('sends the key even when the page sent none', async () => {
    const { fetch, calls } = upstream()
    const request = new Request(`${APP}/api/openrouter/generation?id=gen-1`)
    await forwardToOpenRouter({ request, apiKey: KEY, fetch })
    expect(headerOf(calls[0], 'authorization')).toBe(`Bearer ${KEY}`)
    expect(calls[0]?.init.method).toBe('GET')
  })

  it('does not pass the placeholder, cookies, origin or referer upstream', async () => {
    const { fetch, calls } = upstream()
    await forwardToOpenRouter({
      request: chat({
        cookie: 'a=b',
        origin: APP,
        referer: `${APP}/electron.html`,
        'x-anything': '1',
      }),
      apiKey: KEY,
      fetch,
    })
    const sent = new Headers(calls[0]?.init.headers)
    expect(sent.get('authorization')).not.toContain('placeholder')
    expect(sent.get('cookie')).toBeNull()
    expect(sent.get('origin')).toBeNull()
    expect(sent.get('referer')).toBeNull()
    expect(sent.get('x-anything')).toBeNull()
    expect(sent.get('content-type')).toBe('application/json')
  })

  it('streams the request body upstream', async () => {
    const { fetch, calls } = upstream()
    await forwardToOpenRouter({
      request: chat({}, '{"model":"m","stream":true}'),
      apiKey: KEY,
      fetch,
    })
    const body = calls[0]?.init.body
    expect(await new Response(body as ReadableStream).text()).toBe(
      '{"model":"m","stream":true}',
    )
    const init = calls[0]?.init as { duplex?: string } | undefined
    expect(init?.duplex).toBe('half')
  })

  it('does not follow redirects with the key attached', async () => {
    const { fetch, calls } = upstream()
    await forwardToOpenRouter({ request: chat(), apiKey: KEY, fetch })
    expect(calls[0]?.init.redirect).toBe('error')
  })

  it('aborts the upstream request when the response body is cancelled', async () => {
    let sourceCancelled = false
    const { fetch, calls } = upstream(
      () =>
        new Response(
          new ReadableStream({
            start: (controller) => {
              controller.enqueue(new TextEncoder().encode('data: {"n":1}\n\n'))
            },
            cancel: () => {
              sourceCancelled = true
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    )
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    const signal = calls[0]?.init.signal
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    await reader.read()
    expect(signal?.aborted).toBe(false)
    await reader.cancel()
    expect(signal?.aborted).toBe(true)
    expect(sourceCancelled).toBe(true)
  })

  it('aborts when the body is cancelled before any chunk is read', async () => {
    const { fetch, calls } = upstream(
      () =>
        new Response(new ReadableStream({ pull: () => new Promise(() => {}) })),
    )
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    await response.body?.cancel()
    expect(calls[0]?.init.signal?.aborted).toBe(true)
  })

  it('does not abort the upstream request once the body is read to the end', async () => {
    const { fetch, calls } = upstream()
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    await response.text()
    expect(calls[0]?.init.signal?.aborted).toBe(false)
  })

  it('passes a body that fails on to the reader', async () => {
    const { fetch } = upstream(
      () =>
        new Response(
          new ReadableStream({
            pull: () => {
              throw new Error('upstream reset')
            },
          }),
        ),
    )
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    await expect(response.text()).rejects.toThrow()
  })

  it('answers without a body when upstream sends none', async () => {
    const { fetch } = upstream(() => new Response(null, { status: 204 }))
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  it('returns the upstream status, body and content type', async () => {
    const { fetch } = upstream(
      () =>
        new Response('data: {"id":"gen-1"}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    )
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(await response.text()).toBe('data: {"id":"gen-1"}\n\n')
  })

  it('keeps an upstream error status and its body', async () => {
    const { fetch } = upstream(
      () =>
        new Response('{"error":{"code":402,"message":"credits"}}', {
          status: 402,
          headers: {
            'content-type': 'application/json',
            'retry-after': '3',
          },
        }),
    )
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    expect(response.status).toBe(402)
    expect(response.headers.get('retry-after')).toBe('3')
    expect(await response.text()).toContain('credits')
  })

  it('never puts the key in the response headers', async () => {
    const { fetch } = upstream(
      () =>
        new Response('{}', {
          status: 200,
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${KEY}`,
            'set-cookie': `k=${KEY}`,
            'x-echo': KEY,
            'content-encoding': 'gzip',
          },
        }),
    )
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    const dump = [...response.headers.entries()].join('\n')
    expect(dump).not.toContain(KEY)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('content-encoding')).toBeNull()
  })

  it('answers 401 without calling upstream when there is no key', async () => {
    const { fetch, calls } = upstream()
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: undefined,
      fetch,
    })
    expect(calls).toHaveLength(0)
    expect(response.status).toBe(401)
    const body = (await response.json()) as {
      error: { code: number; message: string }
    }
    expect(body.error.code).toBe(401)
    expect(body.error.message).toMatch(/key/i)
  })

  it('answers 404 without calling upstream for a path outside the table', async () => {
    const { fetch, calls } = upstream()
    const request = new Request(`${APP}/api/openrouter/key`)
    const response = await forwardToOpenRouter({ request, apiKey: KEY, fetch })
    expect(calls).toHaveLength(0)
    expect(response.status).toBe(404)
  })

  it('answers 502 without the key when the network fails', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError(`fetch failed for Bearer ${KEY}`)
    }) as unknown as typeof globalThis.fetch
    const response = await forwardToOpenRouter({
      request: chat(),
      apiKey: KEY,
      fetch,
    })
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain(KEY)
  })
})
