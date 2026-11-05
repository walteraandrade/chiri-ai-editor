import { extname, isAbsolute, relative, resolve } from 'node:path'
import { RENDERER_ENTRY } from './app-url'

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

const decode = (pathname: string): string | null => {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return null
  }
}

export const resolveAssetPath = (
  rootDir: string,
  pathname: string,
): string | null => {
  const decoded = decode(pathname === '/' ? `/${RENDERER_ENTRY}` : pathname)
  if (decoded === null || decoded.includes('\0') || decoded.includes('\\'))
    return null
  if (decoded.startsWith('//')) return null
  const target = resolve(rootDir, `.${decoded}`)
  const inside = relative(rootDir, target)
  return inside === '' || inside.startsWith('..') || isAbsolute(inside)
    ? null
    : target
}

export const contentTypeFor = (path: string): string =>
  CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
