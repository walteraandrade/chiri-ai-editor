import { describe, expect, it } from 'vitest'
import { revealParts } from './word-reveal'

describe('revealParts', () => {
  it('staggers words 34 ms apart and keeps the spaces between them', () => {
    expect(revealParts('Ship it today')).toEqual([
      { text: 'Ship', delayMs: 0 },
      { text: ' ', delayMs: null },
      { text: 'it', delayMs: 34 },
      { text: ' ', delayMs: null },
      { text: 'today', delayMs: 68 },
    ])
  })

  it('keeps leading, trailing and line-break whitespace as is', () => {
    expect(revealParts(' a\n\nb ')).toEqual([
      { text: ' ', delayMs: null },
      { text: 'a', delayMs: 0 },
      { text: '\n\n', delayMs: null },
      { text: 'b', delayMs: 34 },
      { text: ' ', delayMs: null },
    ])
  })

  it('fits a long Replacement into the 560 ms budget', () => {
    const delays = revealParts(Array(100).fill('word').join(' ')).flatMap(
      (part) => (part.delayMs === null ? [] : [part.delayMs]),
    )
    expect(delays).toHaveLength(100)
    expect(delays.at(-1)).toBeLessThanOrEqual(560)
    expect(delays[1]).toBeLessThan(34)
  })

  it('has nothing to reveal in an empty text', () => {
    expect(revealParts('')).toEqual([])
  })
})
