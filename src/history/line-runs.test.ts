import { describe, expect, it } from 'vitest'
import { lineRuns } from './line-runs'

describe('lineRuns', () => {
  it('ignores trailing newlines on both sides', () => {
    expect(lineRuns('a\nb\n\n\n', 'a\nb')).toEqual(lineRuns('a\nb', 'a\nb\n'))
  })

  it('keeps blank lines that are not trailing', () => {
    expect(lineRuns('a\n\nb\n', 'a\n\nc\n\n')).toEqual(
      lineRuns('a\n\nb', 'a\n\nc'),
    )
  })
})
