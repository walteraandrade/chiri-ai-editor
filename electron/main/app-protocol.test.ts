import { describe, expect, it, vi } from 'vitest'
import { createAppHandler } from './app-protocol'
import { CONTENT_SECURITY_POLICY } from './security'

const ROOT = '/opt/desafinado/resources/app.asar/out/renderer'
const KEY = 'sk-or-v1-dummy-for-tests'

const files: Record<string, string> = {
  [`${ROOT}/electron.html`]: '<!doctype html><title>Desafinado</title>',
  [`${ROOT}/assets/index-1.js`]: 'export {}',
  [`${ROOT}/assets/font.woff2`]: 'woff2-bytes',
}

const build = (
  options: {
    readonly key?: string | undefined
    readonly readFile?: (path: string) => Promise<Uint8Array>
  } = {},
) => {
  const upstream: { url: string; headers: Headers }[] = []
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      upstream.push({ url: String(url), headers: new Headers(init?.headers) })
      return Response.json({ id: 'gen-1' })
    },
  ) as unknown as typeof globalThis.fetch
  const readFile =
    options.readFile ??
    vi.fn(async (path: string) => {
      const content = files[path]
      if (content === undefined)
        throw Object.assign(new Error(`ENOENT ${path}`), { code: 'ENOENT' })
      return new TextEncoder().encode(content)
    })
  const handler = createAppHandler({
    rendererDir: ROOT,
    readFile,
    openRouterKey: () => ('key' in options ? options.key : KEY),
    fetch,
  })
  return { handler, readFile, fetch, upstream }
}

const get = (path: string, init: RequestInit = {}) =>
  new Request(`app://desafinado${path}`, init)

describe('createAppHandler: the bundle', () => {
  it('serves the entry with the security headers', async () => {
    const { handler } = build()
    const response = await handler(get('/electron.html'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    expect(response.headers.get('content-security-policy')).toBe(
      CONTENT_SECURITY_POLICY,
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toContain('Desafinado')
  })

  it('serves the entry for the root path', async () => {
    const { handler } = build()
    const response = await handler(get('/'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Desafinado')
  })

  it('serves assets with their content type', async () => {
    const { handler } = build()
    const script = await handler(get('/assets/index-1.js'))
    expect(script.headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    )
    const font = await handler(get('/assets/font.woff2'))
    expect(font.headers.get('content-type')).toBe('font/woff2')
  })

  it('answers a HEAD request without a body', async () => {
    const { handler } = build()
    const response = await handler(get('/electron.html', { method: 'HEAD' }))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })

  it('answers 404 for a missing file', async () => {
    const { handler } = build()
    const response = await handler(get('/assets/missing.js'))
    expect(response.status).toBe(404)
  })

  it('never reads outside the bundle', async () => {
    const { handler, readFile } = build()
    for (const path of [
      '/../main/index.js',
      '/..%2fmain%2findex.js',
      '/%2e%2e/main/index.js',
      '/assets/..%2f..%2f..%2fmain%2findex.js',
    ])
      expect((await handler(get(path))).status).toBe(404)
    for (const [path] of (readFile as ReturnType<typeof vi.fn>).mock.calls)
      expect(path.startsWith(`${ROOT}/`)).toBe(true)
  })

  it('answers 404 for another host on the scheme', async () => {
    const { handler, readFile } = build()
    const response = await handler(new Request('app://other/electron.html'))
    expect(response.status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('answers 405 to a write method on the bundle', async () => {
    const { handler } = build()
    const response = await handler(
      get('/electron.html', { method: 'POST', body: 'x' }),
    )
    expect(response.status).toBe(405)
  })

  it('answers 500 without the path when reading fails', async () => {
    const { handler } = build({
      readFile: async () => {
        throw Object.assign(new Error(`EIO ${ROOT}/secret`), { code: 'EIO' })
      },
    })
    const response = await handler(get('/electron.html'))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain(ROOT)
  })
})

describe('createAppHandler: OpenRouter', () => {
  const chat = (init: RequestInit = {}) =>
    get('/api/openrouter/chat/completions', {
      method: 'POST',
      body: '{}',
      headers: { authorization: 'Bearer browser-placeholder-key' },
      ...init,
    })

  it('forwards with the key held by the main process', async () => {
    const { handler, upstream } = build()
    const response = await handler(chat())
    expect(response.status).toBe(200)
    expect(upstream).toHaveLength(1)
    expect(upstream[0]?.url).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    )
    expect(upstream[0]?.headers.get('authorization')).toBe(`Bearer ${KEY}`)
  })

  it('reads the key on every request', async () => {
    let key: string | undefined
    const upstream: Headers[] = []
    const handler = createAppHandler({
      rendererDir: ROOT,
      readFile: async () => new Uint8Array(),
      openRouterKey: () => key,
      fetch: (async (_url: unknown, init?: RequestInit) => {
        upstream.push(new Headers(init?.headers))
        return Response.json({})
      }) as typeof globalThis.fetch,
    })
    expect((await handler(chat())).status).toBe(401)
    key = KEY
    expect((await handler(chat())).status).toBe(200)
    expect(upstream[0]?.get('authorization')).toBe(`Bearer ${KEY}`)
  })

  it('answers 401 when no key is set and does not call upstream', async () => {
    const { handler, fetch } = build({ key: undefined })
    expect((await handler(chat())).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuses a request that another origin initiated', async () => {
    const { handler, fetch } = build()
    const request = Object.assign(chat(), {
      initiatorOrigin: 'https://example.com',
    })
    expect((await handler(request)).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('accepts a request that the app initiated', async () => {
    const { handler } = build()
    const request = Object.assign(chat(), {
      initiatorOrigin: 'app://desafinado',
    })
    expect((await handler(request)).status).toBe(200)
  })

  it('never returns the key', async () => {
    const { handler } = build()
    const response = await handler(chat())
    const dump =
      [...response.headers.entries()].join('\n') + (await response.text())
    expect(dump).not.toContain(KEY)
  })
})
