import { describe, expect, it } from 'vitest'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { extractBlocks } from './extract-blocks'

describe('extractBlocks', () => {
  it('returns no Blocks for an empty Document', () => {
    expect(extractBlocks('')).toEqual([])
  })

  it('returns no Blocks for a whitespace-only Document', () => {
    expect(extractBlocks('\n\n  \n')).toEqual([])
  })

  it('numbers Blocks p1…pn in Document order', () => {
    const blocks = extractBlocks('# A\n\nOne.\n\nTwo.\n')
    expect(blocks.map((block) => block.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('slices each Block text from the Document', () => {
    const doc = '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n'
    const blocks = extractBlocks(doc)
    expect(blocks.map((block) => block.text)).toEqual([
      '# Title',
      'First paragraph.',
      'Second paragraph.',
    ])
    for (const block of blocks) {
      expect(doc.slice(block.from, block.to)).toBe(block.text)
    }
  })

  it('classifies headings with their level', () => {
    const blocks = extractBlocks('# One\n\n## Two\n\n### Three\n')
    expect(blocks.map(({ kind, level }) => ({ kind, level }))).toEqual([
      { kind: 'heading', level: 1 },
      { kind: 'heading', level: 2 },
      { kind: 'heading', level: 3 },
    ])
  })

  it('classifies setext headings', () => {
    const [block] = extractBlocks('Title\n=====\n')
    expect(block).toMatchObject({ kind: 'heading', level: 1 })
    const [second] = extractBlocks('Sub\n---\n')
    expect(second).toMatchObject({ kind: 'heading', level: 2 })
  })

  it('treats a whole list without blank lines as one Block', () => {
    const blocks = extractBlocks('Intro:\n\n- a\n- b\n- c\n\nOutro.\n')
    expect(blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'list',
      'paragraph',
    ])
    expect(blocks[1]?.text).toBe('- a\n- b\n- c')
  })

  it('treats a loose list and an ordered list as one Block each', () => {
    const blocks = extractBlocks('- a\n\n- b\n\n1. one\n2. two\n')
    expect(blocks.map((block) => block.kind)).toEqual(['list', 'list'])
    expect(blocks[0]?.text).toBe('- a\n\n- b')
  })

  it('keeps a fenced code block with blank lines as one Block', () => {
    const doc =
      'Before.\n\n```js\nconst a = 1\n\n\nconst b = 2\n```\n\nAfter.\n'
    const blocks = extractBlocks(doc)
    expect(blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'code',
      'paragraph',
    ])
    expect(blocks[1]?.text).toBe('```js\nconst a = 1\n\n\nconst b = 2\n```')
  })

  it('classifies an indented code block as code', () => {
    const blocks = extractBlocks('Text.\n\n    indented()\n')
    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'code'])
  })

  it('classifies blockquotes', () => {
    const blocks = extractBlocks('> quoted\n> still quoted\n')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      kind: 'blockquote',
      text: '> quoted\n> still quoted',
    })
  })

  it('classifies tables, html, rules and link references', () => {
    const blocks = extractBlocks(
      '| a | b |\n|---|---|\n| 1 | 2 |\n\n<div>hi</div>\n\n***\n\n[ref]: https://example.com\n',
    )
    expect(blocks.map((block) => block.kind)).toEqual([
      'table',
      'html',
      'rule',
      'other',
    ])
  })

  it('extracts the sample Document', () => {
    const blocks = extractBlocks(SAMPLE_DOCUMENT)
    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'heading',
      'paragraph',
      'paragraph',
      'paragraph',
      'heading',
      'paragraph',
      'list',
      'paragraph',
      'paragraph',
      'code',
      'paragraph',
      'paragraph',
    ])
    expect(blocks[7]?.text.split('\n')).toHaveLength(4)
    expect(blocks[10]?.text.startsWith('```bash')).toBe(true)
    expect(blocks[11]?.text).toContain('recieve')
  })
})
