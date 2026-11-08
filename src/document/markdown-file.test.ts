import { describe, expect, it } from 'vitest'
import { DEFAULT_FILE_NAME, suggestedFileName } from './markdown-file'

describe('suggestedFileName', () => {
  it('names the file after the document title', () => {
    expect(suggestedFileName('# Release Notes\n\nBody.')).toBe(
      'release-notes.md',
    )
  })

  it('drops accents and punctuation', () => {
    expect(suggestedFileName('# Ação: um plano, v2!\n')).toBe(
      'acao-um-plano-v2.md',
    )
  })

  it('uses the first level 1 heading, not a comment in a code block', () => {
    const doc = '```sh\n# install\n```\n\n## Setup\n\n# Real Title\n'
    expect(suggestedFileName(doc)).toBe('real-title.md')
  })

  it('caps the name length without a trailing dash', () => {
    const name = suggestedFileName(`# ${'word '.repeat(30)}`)
    expect(name.length).toBeLessThanOrEqual(63)
    expect(name).toMatch(/^word(-word)*\.md$/)
  })

  it('trims dashes at both ends of the slug', () => {
    expect(suggestedFileName('# -- Hello, World! --\n')).toBe('hello-world.md')
  })

  it('falls back to a default name without a usable title', () => {
    expect(suggestedFileName('Just a paragraph.')).toBe(DEFAULT_FILE_NAME)
    expect(suggestedFileName('# !!!\n')).toBe(DEFAULT_FILE_NAME)
    expect(suggestedFileName('')).toBe(DEFAULT_FILE_NAME)
  })
})
