import { describe, expect, it } from 'vitest'
import { coveredTop, spaceBelow } from './tooltip-space'

describe('coveredTop', () => {
  it('is zero while the editor starts below the header', () => {
    expect(coveredTop(68, 84)).toBe(0)
  })

  it('is the overlap while the header covers the top of the editor', () => {
    expect(coveredTop(68, 30)).toBe(38)
  })

  it('is the whole header once the editor is scrolled past it', () => {
    expect(coveredTop(68, -400)).toBe(68)
  })

  it('is zero without a header', () => {
    expect(coveredTop(-10, -400)).toBe(0)
  })
})

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
