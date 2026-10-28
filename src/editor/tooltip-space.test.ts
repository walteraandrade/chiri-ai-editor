import { describe, expect, it } from 'vitest'
import { spaceBelow } from './tooltip-space'

describe('spaceBelow', () => {
  it('starts the space under the inset and keeps the rest of the viewport', () => {
    expect(spaceBelow(72, { width: 1200, height: 900 })).toEqual({
      top: 72,
      left: 0,
      right: 1200,
      bottom: 900,
    })
  })

  it('never starts above the viewport', () => {
    expect(spaceBelow(-30, { width: 800, height: 600 }).top).toBe(0)
  })
})
