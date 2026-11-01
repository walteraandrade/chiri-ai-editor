import { APP_HOST, APP_ORIGIN } from './app-url'
import { forwardToOpenRouter, isOpenRouterPath } from './openrouter-forward'
import { SECURITY_HEADERS } from './security'
import { contentTypeFor, resolveAssetPath } from './static-files'

type AppHandlerDeps = {
  readonly rendererDir: string
  readonly readFile: (path: string) => Promise<Uint8Array>
  readonly openRouterKey: () => string | undefined
  readonly fetch: typeof globalThis.fetch
}

const plain = (status: number): Response =>
  new Response(null, { status, headers: SECURITY_HEADERS })

const initiatorOf = (request: Request): string | undefined =>
  (request as { initiatorOrigin?: string }).initiatorOrigin

const isMissing = (error: unknown): boolean =>
  (error as { code?: unknown }).code === 'ENOENT'

const serveFile = async (
  { rendererDir, readFile }: AppHandlerDeps,
  request: Request,
  pathname: string,
): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405)
  const path = resolveAssetPath(rendererDir, pathname)
  if (path === null) return plain(404)
  try {
    const content = await readFile(path)
    return new Response(request.method === 'HEAD' ? null : content, {
      headers: {
        ...SECURITY_HEADERS,
        'content-type': contentTypeFor(path),
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return plain(isMissing(error) ? 404 : 500)
  }
}

export const createAppHandler =
  (deps: AppHandlerDeps) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST) return plain(404)
    if (!isOpenRouterPath(url.pathname))
      return serveFile(deps, request, url.pathname)
    const initiator = initiatorOf(request)
    if (initiator !== undefined && initiator !== APP_ORIGIN) return plain(403)
    return forwardToOpenRouter({
      request,
      apiKey: deps.openRouterKey(),
      fetch: deps.fetch,
    })
  }
