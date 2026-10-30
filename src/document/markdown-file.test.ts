import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILE_NAME,
  decodeMarkdown,
  suggestedFileName,
} from './markdown-file'

const BOM = String.fromCharCode(0xfeff)

describe('decodeMarkdown', () => {
  it('drops a leading byte order mark', () => {
    expect(decodeMarkdown(`${BOM}# Title`)).toBe('# Title')
  })

  it('keeps everything else as it is', () => {
    expect(decodeMarkdown(`# Title\r\n\nBody ${BOM}`)).toBe(
      `# Title\r\n\nBody ${BOM}`,
    )
  })
})

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

  it('falls back to a default name without a usable title', () => {
    expect(suggestedFileName('Just a paragraph.')).toBe(DEFAULT_FILE_NAME)
    expect(suggestedFileName('# !!!\n')).toBe(DEFAULT_FILE_NAME)
    expect(suggestedFileName('')).toBe(DEFAULT_FILE_NAME)
  })
})
