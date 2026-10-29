import { describe, expect, it } from 'vitest'
import { formatCtrlShortcut, formatShortcut, isApplePlatform } from './platform'

describe('isApplePlatform', () => {
  it('detects Apple platforms', () => {
    expect(isApplePlatform('MacIntel')).toBe(true)
    expect(isApplePlatform('iPhone')).toBe(true)
  })

  it('treats everything else as non-Apple', () => {
    expect(isApplePlatform('Linux x86_64')).toBe(false)
    expect(isApplePlatform('Win32')).toBe(false)
    expect(isApplePlatform('')).toBe(false)
  })
})

describe('formatShortcut', () => {
  it('uses the command symbol on Apple platforms', () => {
    expect(formatShortcut('K', true)).toBe('⌘K')
  })

  it('uses Ctrl elsewhere', () => {
    expect(formatShortcut('K', false)).toBe('Ctrl+K')
  })
})

describe('formatCtrlShortcut', () => {
  it('uses the control symbol on Apple platforms, where the key stays Control', () => {
    expect(formatCtrlShortcut('H', true)).toBe('⌃H')
  })

  it('uses Ctrl elsewhere', () => {
    expect(formatCtrlShortcut('H', false)).toBe('Ctrl+H')
  })
})
