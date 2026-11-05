import { describe, expect, it } from 'vitest'
import { contrast, mixHex, rgbOf } from './color'

describe('rgbOf', () => {
  it('reads six digit, short and alpha hex', () => {
    expect(rgbOf('#ff8000')).toEqual([255, 128, 0])
    expect(rgbOf('#f80')).toEqual([255, 136, 0])
    expect(rgbOf('#ff800080')).toEqual([255, 128, 0])
  })
})

describe('contrast', () => {
  it('is 21:1 between black and white, in either order', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21)
  })

  it('is 1:1 for one color', () => {
    expect(contrast('#771133', '#771133')).toBeCloseTo(1)
  })

  it('matches a known WCAG value', () => {
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})

describe('mixHex', () => {
  it('returns each end at 0 and 1', () => {
    expect(mixHex('#102030', '#f0e0d0', 0)).toBe('#102030')
    expect(mixHex('#102030', '#f0e0d0', 1)).toBe('#f0e0d0')
  })

  it('mixes channels in sRGB and answers solid hex', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#00000080', '#ffffff', 0.5)).toBe('#808080')
  })
})
