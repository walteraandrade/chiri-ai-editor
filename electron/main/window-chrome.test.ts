import { describe, expect, it } from 'vitest'
import {
  parseTitleBarColors,
  TITLE_BAR_HEIGHT,
  windowChrome,
} from './window-chrome'

const COLORS = { color: '#1e0e3f', symbolColor: '#ffdd00' } as const

describe('windowChrome', () => {
  it('hides the native title bar and paints the controls overlay on Linux', () => {
    expect(windowChrome('linux', COLORS)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: { ...COLORS, height: TITLE_BAR_HEIGHT },
    })
  })

  it('keeps the traffic lights inside the bar on macOS', () => {
    expect(windowChrome('darwin', COLORS)).toEqual({
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 11 },
    })
  })
})

describe('parseTitleBarColors', () => {
  it('accepts two six-digit hex colors', () => {
    expect(parseTitleBarColors(COLORS)).toEqual(COLORS)
  })

  it('drops extra fields', () => {
    expect(parseTitleBarColors({ ...COLORS, height: 400 })).toEqual(COLORS)
  })

  it.each([
    null,
    'red',
    { color: '#1e0e3f' },
    { color: 'red', symbolColor: '#ffdd00' },
    { color: '#1e0e3f', symbolColor: 'url(x)' },
    { color: '#fff', symbolColor: '#000' },
  ])('rejects %j', (input) => {
    expect(parseTitleBarColors(input)).toBeNull()
  })
})
