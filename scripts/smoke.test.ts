import { describe, expect, it } from 'vitest'
import { findAppPage, isRendered } from './smoke'

describe('findAppPage', () => {
  it('picks the page served on app://', () => {
    const page = {
      type: 'page',
      url: 'app://chiri/index.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9333/devtools/page/1',
    }
    expect(
      findAppPage([
        { type: 'other', url: 'app://chiri/', webSocketDebuggerUrl: 'ws://x' },
        { type: 'page', url: 'about:blank', webSocketDebuggerUrl: 'ws://y' },
        page,
      ]),
    ).toBe(page)
  })

  it('returns nothing while the window has not loaded', () => {
    expect(findAppPage([{ type: 'page', url: 'about:blank' }])).toBeUndefined()
    expect(findAppPage([])).toBeUndefined()
  })
})

describe('isRendered', () => {
  it('accepts only an explicit true', () => {
    expect(isRendered(true)).toBe(true)
    expect(isRendered(false)).toBe(false)
    expect(isRendered(undefined)).toBe(false)
    expect(isRendered('true')).toBe(false)
  })
})
