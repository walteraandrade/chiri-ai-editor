import { describe, expect, it } from 'vitest'
import { countWords } from './count-words'

describe('countWords', () => {
  it('counts runs of non-space characters', () => {
    expect(countWords('one  two\nthree\t four')).toBe(4)
  })

  it('counts nothing in blank text', () => {
    expect(countWords('')).toBe(0)
    expect(countWords(' \n\t ')).toBe(0)
  })
})
