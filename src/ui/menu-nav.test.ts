import { describe, expect, it } from 'vitest'
import { nextEnabled } from './menu-nav'

describe('nextEnabled', () => {
  const enabled = [true, false, true, true]

  it('moves down to the next enabled item and wraps', () => {
    expect(nextEnabled(enabled, 0, 1)).toBe(2)
    expect(nextEnabled(enabled, 3, 1)).toBe(0)
  })

  it('moves up, skipping disabled items, and wraps', () => {
    expect(nextEnabled(enabled, 2, -1)).toBe(0)
    expect(nextEnabled(enabled, 0, -1)).toBe(3)
  })

  it('starts from the first or last enabled item when none is active', () => {
    expect(nextEnabled([false, true, true], -1, 1)).toBe(1)
    expect(nextEnabled([true, true, false], -1, -1)).toBe(1)
  })

  it('returns -1 when nothing is enabled', () => {
    expect(nextEnabled([false, false], 0, 1)).toBe(-1)
    expect(nextEnabled([], -1, 1)).toBe(-1)
  })
})
