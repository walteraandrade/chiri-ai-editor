import { describe, expect, it } from 'vitest'
import { APP_ORIGIN, BUNDLE_URL, resolveAppUrl } from './app-url'

describe('resolveAppUrl', () => {
  it('serves the bundle on the app scheme in a packaged app', () => {
    expect(resolveAppUrl({ packaged: true, devServerUrl: undefined })).toBe(
      BUNDLE_URL,
    )
  })

  it('ignores the dev server URL in a packaged app', () => {
    expect(
      resolveAppUrl({ packaged: true, devServerUrl: 'http://localhost:5307' }),
    ).toBe(BUNDLE_URL)
  })

  it('loads the dev server entry in a dev run', () => {
    expect(
      resolveAppUrl({ packaged: false, devServerUrl: 'http://localhost:5307' }),
    ).toBe('http://localhost:5307/electron.html')
  })

  it('serves the bundle on the app scheme in an unpackaged run without a dev server', () => {
    expect(resolveAppUrl({ packaged: false, devServerUrl: undefined })).toBe(
      BUNDLE_URL,
    )
  })

  it('treats an empty dev server URL as absent', () => {
    expect(resolveAppUrl({ packaged: false, devServerUrl: '' })).toBe(
      BUNDLE_URL,
    )
  })
})

describe('the bundle URL', () => {
  it('lives on the app origin', () => {
    expect(BUNDLE_URL.startsWith(`${APP_ORIGIN}/`)).toBe(true)
    expect(APP_ORIGIN).toBe('app://chiri')
  })
})
