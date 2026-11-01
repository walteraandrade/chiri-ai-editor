import { describe, expect, it } from 'vitest'
import { appOrigin, isAppNavigation, isTrustedFrame } from './trust'

const DEV_URL = 'http://localhost:5301/electron.html'
const FILE_URL = 'file:///opt/chiri/out/renderer/electron.html'

describe('appOrigin', () => {
  it('is the origin of the dev server', () => {
    expect(appOrigin(DEV_URL)).toBe('http://localhost:5301')
  })

  it('is the file origin for a file URL', () => {
    expect(appOrigin(FILE_URL)).toBe('file://')
  })
})

describe('isAppNavigation', () => {
  it('allows the dev server origin', () => {
    expect(isAppNavigation('http://localhost:5301/', DEV_URL)).toBe(true)
    expect(isAppNavigation('http://localhost:5301/a?b=1#c', DEV_URL)).toBe(true)
  })

  it('blocks another port, host or scheme', () => {
    expect(isAppNavigation('http://localhost:5302/', DEV_URL)).toBe(false)
    expect(isAppNavigation('http://127.0.0.1:5301/', DEV_URL)).toBe(false)
    expect(isAppNavigation('https://localhost:5301/', DEV_URL)).toBe(false)
    expect(isAppNavigation('https://example.com/', DEV_URL)).toBe(false)
    expect(isAppNavigation('file:///etc/passwd', DEV_URL)).toBe(false)
  })

  it('allows only the app document for a file URL', () => {
    expect(isAppNavigation(`${FILE_URL}#top`, FILE_URL)).toBe(true)
    expect(isAppNavigation('file:///etc/passwd', FILE_URL)).toBe(false)
    expect(isAppNavigation('http://localhost:5301/', FILE_URL)).toBe(false)
  })

  it('blocks a URL that does not parse', () => {
    expect(isAppNavigation('not a url', DEV_URL)).toBe(false)
  })
})

describe('isTrustedFrame', () => {
  it('trusts a frame on the app origin', () => {
    expect(isTrustedFrame({ origin: 'http://localhost:5301' }, DEV_URL)).toBe(
      true,
    )
    expect(isTrustedFrame({ origin: 'file://' }, FILE_URL)).toBe(true)
  })

  it('does not trust a frame on another origin', () => {
    expect(isTrustedFrame({ origin: 'https://example.com' }, DEV_URL)).toBe(
      false,
    )
    expect(isTrustedFrame({ origin: 'null' }, DEV_URL)).toBe(false)
  })

  it('does not trust a frame that is gone', () => {
    expect(isTrustedFrame(null, DEV_URL)).toBe(false)
  })
})
