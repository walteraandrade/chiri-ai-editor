export const OPENROUTER_API = 'https://openrouter.ai/api/v1'
const PREFIX = '/api/openrouter'

const ROUTES: Readonly<Record<string, string>> = {
  '/chat/completions': 'POST',
  '/generation': 'GET',
}

const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept']
const RETURNED_RESPONSE_HEADERS = ['content-type', 'retry-after']

type ForwardInput = {
  readonly request: Request
  readonly apiKey: string | undefined
  readonly fetch: typeof globalThis.fetch
}

export const isOpenRouterPath = (pathname: string): boolean =>
  pathname.startsWith(`${PREFIX}/`)

export const openRouterTarget = (
  requestUrl: string,
  method: string,
): string | null => {
  try {
    const url = new URL(requestUrl)
    if (!isOpenRouterPath(url.pathname)) return null
    const path = url.pathname.slice(PREFIX.length)
    return ROUTES[path] === method.toUpperCase()
      ? `${OPENROUTER_API}${path}${url.search}`
      : null
  } catch {
    return null
  }
}

const errorResponse = (status: number, message: string): Response =>
  Response.json(
    { error: { code: status, message } },
    { status, headers: { 'cache-control': 'no-store' } },
  )

const pick = (source: Headers, names: readonly string[]): Headers =>
  new Headers(
    names.flatMap((name) => {
      const value = source.get(name)
      return value === null ? [] : [[name, value] as [string, string]]
    }),
  )

const upstreamHeaders = (request: Request, apiKey: string): Headers => {
  const headers = pick(request.headers, FORWARDED_REQUEST_HEADERS)
  headers.set('authorization', `Bearer ${apiKey}`)
  return headers
}

const upstreamInit = (request: Request, apiKey: string): RequestInit => ({
  method: request.method,
  headers: upstreamHeaders(request, apiKey),
  redirect: 'error',
  signal: request.signal,
  ...(request.body === null
    ? {}
    : { body: request.body, duplex: 'half' as const }),
})

const returned = (upstream: Response): Response =>
  new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      ...Object.fromEntries(
        pick(upstream.headers, RETURNED_RESPONSE_HEADERS).entries(),
      ),
      'cache-control': 'no-store',
    },
  })

export const forwardToOpenRouter = async ({
  request,
  apiKey,
  fetch,
}: ForwardInput): Promise<Response> => {
  const target = openRouterTarget(request.url, request.method)
  if (target === null) return errorResponse(404, 'Not found')
  if (apiKey === undefined || apiKey === '')
    return errorResponse(
      401,
      'OpenRouter key missing. Add it with the Key button.',
    )
  try {
    return returned(await fetch(target, upstreamInit(request, apiKey)))
  } catch {
    return errorResponse(502, 'Could not reach OpenRouter.')
  }
}
