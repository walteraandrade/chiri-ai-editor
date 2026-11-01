import { describe, expect, it } from 'vitest'
import { isMarkdownPath, withMarkdownExtension } from './markdown-path'

describe('isMarkdownPath', () => {
  it('accepts .md and .markdown in any case', () => {
    expect(isMarkdownPath('/skills/a/SKILL.md')).toBe(true)
    expect(isMarkdownPath('/notes/readme.markdown')).toBe(true)
    expect(isMarkdownPath('/notes/README.MD')).toBe(true)
  })

  it('refuses everything else', () => {
    expect(isMarkdownPath('/skills/a/run.sh')).toBe(false)
    expect(isMarkdownPath('/skills/a/notes.md.bak')).toBe(false)
    expect(isMarkdownPath('/skills/a/md')).toBe(false)
  })
})

describe('withMarkdownExtension', () => {
  it('adds .md when the name has none of ours', () => {
    expect(withMarkdownExtension('/tmp/notes')).toBe('/tmp/notes.md')
    expect(withMarkdownExtension('/tmp/notes.txt')).toBe('/tmp/notes.txt.md')
  })

  it('keeps a Markdown name as it is', () => {
    expect(withMarkdownExtension('/tmp/notes.md')).toBe('/tmp/notes.md')
    expect(withMarkdownExtension('/tmp/notes.markdown')).toBe(
      '/tmp/notes.markdown',
    )
  })
})
