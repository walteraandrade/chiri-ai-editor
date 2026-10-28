import { describe, expect, it } from 'vitest'
import { SAMPLE_DOCUMENT } from './sample-document'

const countWords = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length

describe('SAMPLE_DOCUMENT', () => {
  it('is between 250 and 400 words', () => {
    const words = countWords(SAMPLE_DOCUMENT)
    expect(words).toBeGreaterThanOrEqual(250)
    expect(words).toBeLessThanOrEqual(400)
  })

  it('has a title, a section heading, a list and a fenced code block', () => {
    expect(SAMPLE_DOCUMENT).toMatch(/^# \S/m)
    expect(SAMPLE_DOCUMENT).toMatch(/^## \S/m)
    expect(SAMPLE_DOCUMENT).toMatch(/^- \S/m)
    expect(SAMPLE_DOCUMENT).toMatch(/^```\w*\n[\s\S]+?\n```$/m)
  })
})
