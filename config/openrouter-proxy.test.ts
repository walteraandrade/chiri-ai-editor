import type { ProxyOptions } from 'vite'
import { describe, expect, it } from 'vitest'
import {
  buildOpenRouterProxy,
  buildOpenRouterProxyTable,
  OPENROUTER_PROXY_PREFIX,
  OPENROUTER_TARGET,
  rewriteOpenRouterPath,
  setAuthorization,
} from './openrouter-proxy'

type ProxyServerArg = Parameters<NonNullable<ProxyOptions['configure']>>[0]
type ProxyReqHandler = (proxyReq: FakeProxyReq) => void

type FakeProxyReq = {
  readonly setHeader: (name: string, value: string) => void
  readonly headers: () => Record<string, string>
}

const createFakeProxyReq = (initial: Record<string, string>): FakeProxyReq => {
  const headers = new Map(
    Object.entries(initial).map(([name, value]) => [name.toLowerCase(), value]),
  )
  return {
    setHeader: (name, value) => {
      headers.set(name.toLowerCase(), value)
    },
    headers: () => Object.fromEntries(headers),
  }
}

const captureProxyReqHandler = (options: ProxyOptions): ProxyReqHandler => {
  const handlers: ProxyReqHandler[] = []
  const fakeProxy = {
    on: (event: string, handler: ProxyReqHandler) => {
      if (event === 'proxyReq') handlers.push(handler)
    },
  }
  options.configure?.(fakeProxy as unknown as ProxyServerArg, options)
  const [handler] = handlers
  if (!handler) throw new Error('proxyReq handler was not registered')
  return handler
}

describe('rewriteOpenRouterPath', () => {
  it('strips the proxy prefix', () => {
    expect(rewriteOpenRouterPath('/api/openrouter/models')).toBe('/models')
  })

  it('keeps nested paths and query strings', () => {
    expect(rewriteOpenRouterPath('/api/openrouter/generation?id=gen-1')).toBe(
      '/generation?id=gen-1',
    )
  })
})

describe('setAuthorization', () => {
  it('overwrites whatever Authorization the browser sent', () => {
    const proxyReq = createFakeProxyReq({ Authorization: 'Bearer placeholder' })
    setAuthorization('real-key')(proxyReq)
    expect(proxyReq.headers().authorization).toBe('Bearer real-key')
  })

  it('adds Authorization when the browser sent none', () => {
    const proxyReq = createFakeProxyReq({})
    setAuthorization('real-key')(proxyReq)
    expect(proxyReq.headers().authorization).toBe('Bearer real-key')
  })
})

describe('buildOpenRouterProxy', () => {
  it('targets OpenRouter with changeOrigin and the prefix rewrite', () => {
    const options = buildOpenRouterProxy('real-key')
    expect(options.target).toBe(OPENROUTER_TARGET)
    expect(options.changeOrigin).toBe(true)
    expect(options.rewrite?.('/api/openrouter/models')).toBe('/models')
  })

  it('overwrites Authorization on every proxied request', () => {
    const handler = captureProxyReqHandler(buildOpenRouterProxy('real-key'))

    const first = createFakeProxyReq({ authorization: 'Bearer placeholder' })
    handler(first)
    const second = createFakeProxyReq({})
    handler(second)

    expect(first.headers().authorization).toBe('Bearer real-key')
    expect(second.headers().authorization).toBe('Bearer real-key')
  })
})

describe('buildOpenRouterProxyTable', () => {
  it('registers a single entry under the prefix', () => {
    const table = buildOpenRouterProxyTable('real-key')
    expect(Object.keys(table)).toEqual([OPENROUTER_PROXY_PREFIX])
  })
})
