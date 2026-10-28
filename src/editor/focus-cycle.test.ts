import { describe, expect, it } from 'vitest'
import { cycleIndex } from './focus-cycle'

describe('cycleIndex', () => {
  it('moves forward to the next item', () => {
    expect(cycleIndex(5, 1, false)).toBe(2)
  })

  it('wraps from the last item to the first', () => {
    expect(cycleIndex(5, 4, false)).toBe(0)
  })

  it('moves backward to the previous item', () => {
    expect(cycleIndex(5, 3, true)).toBe(2)
  })

  it('wraps from the first item to the last', () => {
    expect(cycleIndex(5, 0, true)).toBe(4)
  })

  it('enters at the first item when focus is outside', () => {
    expect(cycleIndex(5, -1, false)).toBe(0)
  })

  it('enters at the last item when focus is outside going backward', () => {
    expect(cycleIndex(5, -1, true)).toBe(4)
  })

  it('stays on a single item', () => {
    expect(cycleIndex(1, 0, false)).toBe(0)
    expect(cycleIndex(1, 0, true)).toBe(0)
  })

  it('returns -1 when there is nothing to focus', () => {
    expect(cycleIndex(0, -1, false)).toBe(-1)
  })
})
