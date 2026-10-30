import { describe, expect, it } from 'vitest'
import { adaptiveDiff } from '../diff/adaptive-diff'
import { changeLabel, changeRanges, showsChanges, stepChange } from './changes'

const at = (from: number, original: string, replacement: string) => ({
  from,
  original,
  diff: adaptiveDiff(original, replacement),
})

describe('changeRanges', () => {
  it('finds where each change sits in the Document', () => {
    const suggestion = at(
      100,
      'The team review their work and it matter a lot.',
      'The team reviews their work and it matters a lot.',
    )
    expect(changeRanges(suggestion)).toEqual([
      { from: 109, to: 115 },
      { from: 134, to: 140 },
    ])
  })

  it('counts a deletion and its insertion as one change', () => {
    expect(changeRanges(at(0, 'one two three', 'one 2 three'))).toEqual([
      { from: 4, to: 7 },
    ])
  })

  it('counts a pure insertion as an empty range', () => {
    expect(changeRanges(at(10, 'one three', 'one two three'))).toEqual([
      { from: 14, to: 14 },
    ])
  })

  it('has one change over the whole Target for a block rewrite', () => {
    expect(
      changeRanges(at(7, 'An old sentence here.', 'Something else entirely.')),
    ).toEqual([{ from: 7, to: 28 }])
  })
})

describe('stepChange', () => {
  const ranges = [
    { from: 10, to: 14 },
    { from: 40, to: 46 },
    { from: 90, to: 90 },
  ]

  it('goes to the next change after the cursor', () => {
    expect(stepChange(ranges, 10, 1)).toBe(40)
    expect(stepChange(ranges, 43, 1)).toBe(90)
  })

  it('goes to the change before the one the cursor is in', () => {
    expect(stepChange(ranges, 90, -1)).toBe(40)
    expect(stepChange(ranges, 43, -1)).toBe(10)
    expect(stepChange(ranges, 40, -1)).toBe(10)
  })

  it('wraps around at both ends', () => {
    expect(stepChange(ranges, 95, 1)).toBe(10)
    expect(stepChange(ranges, 12, -1)).toBe(90)
  })

  it('has nowhere to go without changes', () => {
    expect(stepChange([], 5, 1)).toBeUndefined()
  })
})

describe('changeLabel', () => {
  const ranges = [
    { from: 10, to: 14 },
    { from: 40, to: 46 },
    { from: 90, to: 90 },
  ]

  it('counts the changes while the cursor is elsewhere', () => {
    expect(changeLabel(ranges, 50)).toBe('3 changes')
    expect(changeLabel([{ from: 10, to: 12 }], 50)).toBe('1 change')
  })

  it('says which change the cursor is in, anywhere inside it', () => {
    expect(changeLabel(ranges, 40)).toBe('Change 2 of 3')
    expect(changeLabel(ranges, 43)).toBe('Change 2 of 3')
    expect(changeLabel(ranges, 90)).toBe('Change 3 of 3')
  })
})

describe('showsChanges', () => {
  it('shows for two or more changes', () => {
    expect(
      showsChanges(
        at(0, 'one two three four five six', 'one 2 three four five 6'),
      ),
    ).toBe(true)
  })

  it('shows for a Suggestion over more than one line', () => {
    expect(showsChanges(at(0, 'One.\n\nTwo here.', 'One.\n\nTwo there.'))).toBe(
      true,
    )
  })

  it('stays out of the way for one change in one line', () => {
    expect(showsChanges(at(0, 'one two three', 'one 2 three'))).toBe(false)
  })
})
