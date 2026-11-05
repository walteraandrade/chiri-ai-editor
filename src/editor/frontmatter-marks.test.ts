import { describe, expect, it } from 'vitest'
import { frontmatterMarks } from './frontmatter-marks'

const SKILL = '---\nname: demo\ndescription: Does a thing.\n---\n\n# Title\n'

describe('frontmatterMarks', () => {
  it('marks every line of the frontmatter, delimiters included', () => {
    expect(
      frontmatterMarks(SKILL)
        .filter((mark) => mark.kind === 'line')
        .map((mark) => [mark.from, mark.role]),
    ).toEqual([
      [0, 'delimiter'],
      [4, 'body'],
      [15, 'body'],
      [42, 'delimiter'],
    ])
  })

  it('marks the key of each top-level entry', () => {
    expect(
      frontmatterMarks(SKILL)
        .filter((mark) => mark.kind === 'key')
        .map((mark) => SKILL.slice(mark.from, mark.to)),
    ).toEqual(['name', 'description'])
  })

  it('leaves the body alone', () => {
    const lastLine = frontmatterMarks(SKILL).filter(
      (mark) => mark.kind === 'line',
    )
    expect(Math.max(...lastLine.map((mark) => mark.from))).toBeLessThan(
      SKILL.indexOf('# Title'),
    )
  })

  it('marks keys with dashes, quotes and digits', () => {
    const text = '---\nallowed-tools: Read\n"quoted key": 1\nv2: x\n---\n'
    expect(
      frontmatterMarks(text)
        .filter((mark) => mark.kind === 'key')
        .map((mark) => text.slice(mark.from, mark.to)),
    ).toEqual(['allowed-tools', '"quoted key"', 'v2'])
  })

  it('does not take text inside a block scalar or a nested map for a key', () => {
    const text =
      '---\nname: demo\ndescription: |\n  note: not a key\nmetadata:\n  author: me\n---\n'
    expect(
      frontmatterMarks(text)
        .filter((mark) => mark.kind === 'key')
        .map((mark) => text.slice(mark.from, mark.to)),
    ).toEqual(['name', 'description', 'metadata'])
  })

  it('does not take a colon inside a value for a key', () => {
    const text = '---\ndescription: Use when: asked\n---\n'
    expect(
      frontmatterMarks(text)
        .filter((mark) => mark.kind === 'key')
        .map((mark) => text.slice(mark.from, mark.to)),
    ).toEqual(['description'])
  })

  it('handles an empty frontmatter', () => {
    expect(
      frontmatterMarks('---\n---\n\nText\n').map((mark) => mark.kind),
    ).toEqual(['line', 'line'])
  })

  it('handles a frontmatter that ends the document', () => {
    const text = '---\nname: x\n---'
    expect(
      frontmatterMarks(text)
        .filter((mark) => mark.kind === 'line')
        .map((mark) => mark.from),
    ).toEqual([0, 4, 12])
  })

  it.each([
    ['plain text', '# Title\n'],
    ['an empty document', ''],
    ['a rule that is no frontmatter', '---\n\nText.\n'],
    ['a block that is not YAML', '---\nthis is prose\n---\n'],
    ['a frontmatter that is not closed', '---\nname: x\n\n# Title\n'],
    ['a frontmatter below the first line', '\n---\nname: x\n---\n'],
  ])('marks nothing for %s', (_label, text) => {
    expect(frontmatterMarks(text)).toEqual([])
  })
})
