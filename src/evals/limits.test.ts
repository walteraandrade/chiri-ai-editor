import { describe, expect, it } from 'vitest'
import { firstRunLimit, secondRunLimit } from './limits'

describe('cost limit across two runs', () => {
  it('gives the first run half and rounds down', () => {
    expect(firstRunLimit(0.3)).toBe(0.15)
    expect(firstRunLimit(1)).toBe(0.5)
    expect(firstRunLimit(0.00015)).toBe(0.0001)
  })

  it('gives the second run what the first left of the whole limit', () => {
    expect(secondRunLimit(0.3, 0.01)).toBe(0.29)
    expect(secondRunLimit(1, 0.0027)).toBe(0.9973)
  })

  it('never lets the two runs add up to more than the limit', () => {
    const spent = 0.123456
    const second = secondRunLimit(0.3, spent) ?? 0
    expect(spent + second).toBeLessThanOrEqual(0.3)
  })

  it('does not start the second run when nothing is left', () => {
    expect(secondRunLimit(0.3, 0.3)).toBeNull()
    expect(secondRunLimit(0.3, 0.31)).toBeNull()
  })
})
