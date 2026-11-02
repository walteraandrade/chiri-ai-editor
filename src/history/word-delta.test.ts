import { describe, expect, it } from 'vitest'
import { wordDelta } from './word-delta'

describe('wordDelta', () => {
  it('counts words added and removed', () => {
    expect(wordDelta('one two three', 'one 2 three four')).toEqual({
      added: 2,
      removed: 1,
    })
  })

  it('counts every word as added against an empty text', () => {
    expect(wordDelta('', 'one two three')).toEqual({ added: 3, removed: 0 })
  })

  it('counts every word as removed against an empty text', () => {
    expect(wordDelta('one two', '')).toEqual({ added: 0, removed: 2 })
  })

  it('returns zeros when only spacing changed', () => {
    expect(wordDelta('one two', 'one  two\n')).toEqual({ added: 0, removed: 0 })
  })

  it('counts only the lines that changed', () => {
    expect(
      wordDelta(
        'Same first line.\n\nOld middle words.\n\nSame last line.',
        'Same first line.\n\nNew middle words.\n\nSame last line.',
      ),
    ).toEqual({ added: 1, removed: 1 })
  })

  it('counts a wholesale replacement as every word removed and added, quickly', () => {
    const prose = (seed: string, count: number) =>
      Array.from(
        { length: count },
        (_, index) => `${seed}${index}a ${seed}${index}b ${seed}${index}c.`,
      ).join('\n\n')
    const before = prose('alpha', 600)
    const after = prose('beta', 400)
    const started = performance.now()
    const delta = wordDelta(before, after)
    expect(performance.now() - started).toBeLessThan(500)
    expect(delta).toEqual({
      added: after.split(/\s+/).length,
      removed: before.split(/\s+/).length,
    })
  })
})
