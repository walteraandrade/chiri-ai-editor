import { describe, expect, it } from 'vitest'
import { minimalChange } from './minimal-change'

const apply = (
  before: string,
  { from, to, insert }: { from: number; to: number; insert: string },
): string => `${before.slice(0, from)}${insert}${before.slice(to)}`

describe('minimalChange', () => {
  it('replaces only the middle that differs', () => {
    expect(
      minimalChange('# A\n\nOne.\n\nEnd.\n', '# A\n\nOne, two.\n\nEnd.\n'),
    ).toEqual({
      from: 8,
      to: 8,
      insert: ', two',
    })
  })

  it('covers a removal as an empty insert', () => {
    expect(minimalChange('abcdef', 'abef')).toEqual({
      from: 2,
      to: 4,
      insert: '',
    })
  })

  it('covers an addition at the end and at the start', () => {
    expect(minimalChange('abc', 'abcdef')).toEqual({
      from: 3,
      to: 3,
      insert: 'def',
    })
    expect(minimalChange('def', 'abcdef')).toEqual({
      from: 0,
      to: 0,
      insert: 'abc',
    })
  })

  it('does not count the same characters twice when prefix and suffix meet', () => {
    const change = minimalChange('aaa', 'aaaa')
    expect(apply('aaa', change)).toBe('aaaa')
    expect(change.to - change.from).toBeLessThanOrEqual(3)
  })

  it('changes nothing for equal texts', () => {
    expect(minimalChange('same', 'same')).toEqual({
      from: 4,
      to: 4,
      insert: '',
    })
  })

  it('replaces everything when nothing is shared', () => {
    expect(minimalChange('abc', 'xyz')).toEqual({
      from: 0,
      to: 3,
      insert: 'xyz',
    })
  })

  it('never splits a surrogate pair', () => {
    const before = 'a\u{1F600}b'
    const after = 'a\u{1F601}b'
    const change = minimalChange(before, after)
    expect(apply(before, change)).toBe(after)
    expect(change.from).toBe(1)
    expect(change.to).toBe(3)
    expect(change.insert).toBe('\u{1F601}')
  })

  it.each([
    ['', 'abc'],
    ['abc', ''],
    ['one\ntwo\nthree', 'one\n2\nthree'],
    ['x\u{1F600}', '\u{1F600}x'],
  ])('rebuilds the new text from %j to %j', (before, after) => {
    expect(apply(before, minimalChange(before, after))).toBe(after)
  })
})
