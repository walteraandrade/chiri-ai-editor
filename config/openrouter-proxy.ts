import type { ProxyOptions } from 'vite'

export const OPENROUTER_PROXY_PREFIX = '/api/openrouter/'
export const OPENROUTER_TARGET = 'https://openrouter.ai/api/v1'

type HeaderSetter = {
  readonly setHeader: (name: string, value: string) => void
}

export const rewriteOpenRouterPath = (path: string): string =>
  path.replace(/^\/api\/openrouter/, '')

export const setAuthorization =
  (apiKey: string) =>
  (proxyReq: HeaderSetter): void => {
    proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
  }

export const buildOpenRouterProxy = (apiKey: string): ProxyOptions => ({
  target: OPENROUTER_TARGET,
  changeOrigin: true,
  rewrite: rewriteOpenRouterPath,
  configure: (proxy) => {
    proxy.on('proxyReq', setAuthorization(apiKey))
  },
})

export const buildOpenRouterProxyTable = (
  apiKey: string,
): Record<string, ProxyOptions> => ({
  [OPENROUTER_PROXY_PREFIX]: buildOpenRouterProxy(apiKey),
})
