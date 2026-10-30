import { describe, expect, it } from 'vitest'
import { adaptiveDiff } from '../diff/adaptive-diff'
import { changeLabel, changeSpots, showsChanges, stepChange } from './changes'

const at = (from: number, original: string, replacement: string) => ({
  from,
  original,
  diff: adaptiveDiff(original, replacement),
})

describe('changeSpots', () => {
  it('finds where each change starts in the Document', () => {
    const suggestion = at(
      100,
      'The team review their work and it matter a lot.',
      'The team reviews their work and it matters a lot.',
    )
    expect(changeSpots(suggestion)).toEqual([109, 134])
  })

  it('counts a deletion and its insertion as one change', () => {
    expect(changeSpots(at(0, 'one two three', 'one 2 three'))).toEqual([4])
  })

  it('counts a pure insertion', () => {
    expect(changeSpots(at(10, 'one three', 'one two three'))).toEqual([14])
  })

  it('has one change at the start for a block rewrite', () => {
    expect(
      changeSpots(at(7, 'An old sentence here.', 'Something else entirely.')),
    ).toEqual([7])
  })
})

describe('stepChange', () => {
  const spots = [10, 40, 90]

  it('goes to the next change after the cursor', () => {
    expect(stepChange(spots, 10, 1)).toBe(40)
    expect(stepChange(spots, 41, 1)).toBe(90)
  })

  it('goes to the previous change before the cursor', () => {
    expect(stepChange(spots, 90, -1)).toBe(40)
    expect(stepChange(spots, 39, -1)).toBe(10)
  })

  it('wraps around at both ends', () => {
    expect(stepChange(spots, 95, 1)).toBe(10)
    expect(stepChange(spots, 5, -1)).toBe(90)
  })

  it('has nowhere to go without changes', () => {
    expect(stepChange([], 5, 1)).toBeUndefined()
  })
})

describe('changeLabel', () => {
  it('counts the changes while the cursor is elsewhere', () => {
    expect(changeLabel([10, 40, 90], 50)).toBe('3 changes')
    expect(changeLabel([10], 50)).toBe('1 change')
  })

  it('says which change the cursor is on', () => {
    expect(changeLabel([10, 40, 90], 40)).toBe('Change 2 of 3')
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
