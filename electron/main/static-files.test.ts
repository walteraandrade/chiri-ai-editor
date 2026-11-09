import { describe, expect, it } from 'vitest'
import { contentTypeFor, resolveAssetPath } from './static-files'

const ROOT = '/opt/desafinado/resources/app.asar/out/renderer'

describe('resolveAssetPath', () => {
  it('maps a pathname into the root', () => {
    expect(resolveAssetPath(ROOT, '/electron.html')).toBe(
      `${ROOT}/electron.html`,
    )
    expect(resolveAssetPath(ROOT, '/assets/index-ab12.js')).toBe(
      `${ROOT}/assets/index-ab12.js`,
    )
  })

  it('serves the entry for the root path', () => {
    expect(resolveAssetPath(ROOT, '/')).toBe(`${ROOT}/electron.html`)
  })

  it('decodes percent-encoded names', () => {
    expect(resolveAssetPath(ROOT, '/assets/a%20b.woff2')).toBe(
      `${ROOT}/assets/a b.woff2`,
    )
  })

  it('refuses paths that climb out of the root', () => {
    expect(resolveAssetPath(ROOT, '/../main/index.js')).toBeNull()
    expect(resolveAssetPath(ROOT, '/..%2fmain%2findex.js')).toBeNull()
    expect(resolveAssetPath(ROOT, '/%2e%2e/main/index.js')).toBeNull()
    expect(resolveAssetPath(ROOT, '/assets/../../main/index.js')).toBeNull()
    expect(resolveAssetPath(ROOT, '/assets/%2e%2e%2f%2e%2e%2fmain')).toBeNull()
  })

  it('refuses a NUL byte, a backslash and undecodable input', () => {
    expect(resolveAssetPath(ROOT, '/a%00.js')).toBeNull()
    expect(resolveAssetPath(ROOT, '/assets%5c..%5cmain')).toBeNull()
    expect(resolveAssetPath(ROOT, '/%E0%A4%A')).toBeNull()
  })

  it('refuses an absolute path smuggled in as a segment', () => {
    expect(resolveAssetPath(ROOT, '//etc/passwd')).toBeNull()
    expect(resolveAssetPath(ROOT, '/%2fetc/passwd')).toBeNull()
  })
})

describe('contentTypeFor', () => {
  it('knows the types a Vite build emits', () => {
    expect(contentTypeFor('/a/electron.html')).toBe('text/html; charset=utf-8')
    expect(contentTypeFor('/a/index.js')).toBe('text/javascript; charset=utf-8')
    expect(contentTypeFor('/a/index.css')).toBe('text/css; charset=utf-8')
    expect(contentTypeFor('/a/f.woff2')).toBe('font/woff2')
    expect(contentTypeFor('/a/f.woff')).toBe('font/woff')
    expect(contentTypeFor('/a/i.svg')).toBe('image/svg+xml')
    expect(contentTypeFor('/a/i.png')).toBe('image/png')
    expect(contentTypeFor('/a/m.json')).toBe('application/json; charset=utf-8')
  })

  it('falls back to a download type for the rest', () => {
    expect(contentTypeFor('/a/x.bin')).toBe('application/octet-stream')
    expect(contentTypeFor('/a/noext')).toBe('application/octet-stream')
  })

  it('is case-insensitive about the extension', () => {
    expect(contentTypeFor('/a/INDEX.JS')).toBe('text/javascript; charset=utf-8')
  })
})
