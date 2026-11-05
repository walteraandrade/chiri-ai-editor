import { describe, expect, it } from 'vitest'
import {
  blankFrontmatter,
  findFrontmatter,
  touchesFrontmatter,
} from './frontmatter'

const SKILL = '---\nname: demo\ndescription: Does a thing.\n---\n\n# Demo\n'

describe('findFrontmatter', () => {
  it('finds a frontmatter at the start of the Document', () => {
    const found = findFrontmatter(SKILL)
    expect(found).toBeDefined()
    expect(SKILL.slice(found?.from, found?.to)).toBe(
      '---\nname: demo\ndescription: Does a thing.\n---',
    )
  })

  it('exposes the YAML between the delimiters', () => {
    const found = findFrontmatter(SKILL)
    expect(SKILL.slice(found?.yamlFrom, found?.yamlTo)).toBe(
      'name: demo\ndescription: Does a thing.',
    )
  })

  it('returns nothing for a Document without one', () => {
    expect(findFrontmatter('# Title\n\nBody.\n')).toBeUndefined()
    expect(findFrontmatter('')).toBeUndefined()
  })

  it('returns nothing when the closing delimiter is missing', () => {
    expect(findFrontmatter('---\nname: demo\n\n# Demo\n')).toBeUndefined()
    expect(findFrontmatter('---\n')).toBeUndefined()
    expect(findFrontmatter('---')).toBeUndefined()
  })

  it('returns nothing when it is not at offset 0', () => {
    expect(findFrontmatter('\n---\nname: demo\n---\n')).toBeUndefined()
    expect(findFrontmatter('# Title\n\n---\nname: demo\n---\n')).toBeUndefined()
    expect(findFrontmatter(' ---\nname: demo\n---\n')).toBeUndefined()
  })

  it('requires exactly three dashes on both delimiters', () => {
    expect(findFrontmatter('----\nname: demo\n---\n')).toBeUndefined()
    expect(findFrontmatter('---\nname: demo\n----\n')).toBeUndefined()
    expect(findFrontmatter('--- a\nname: demo\n---\n')).toBeUndefined()
    expect(findFrontmatter('---\nname: demo\n--- b\n')).toBeUndefined()
  })

  it('does not close on a dot line', () => {
    expect(findFrontmatter('---\nname: demo\n...\n\nBody.\n')).toBeUndefined()
  })

  it('does not close on an indented delimiter', () => {
    expect(findFrontmatter('---\nname: demo\n ---\n')).toBeUndefined()
  })

  it('tolerates trailing blanks on the delimiters', () => {
    const text = '---  \nname: demo\n---\t\n\nBody.\n'
    const found = findFrontmatter(text)
    expect(text.slice(found?.yamlFrom, found?.yamlTo)).toBe('name: demo')
    expect(text.slice(found?.from, found?.to)).toBe('---  \nname: demo\n---\t')
  })

  it('ends at the closing delimiter, before its line break', () => {
    const found = findFrontmatter('---\na: 1\n---\nBody.')
    expect(found?.to).toBe(12)
  })

  it('accepts a closing delimiter at the very end', () => {
    const text = '---\nname: demo\n---'
    expect(findFrontmatter(text)?.to).toBe(text.length)
  })

  it('stops at the first closing delimiter', () => {
    const text = '---\na: 1\n---\n\nBody.\n\n---\n\nMore.\n'
    expect(text.slice(0, findFrontmatter(text)?.to)).toBe('---\na: 1\n---')
  })

  it('finds an empty frontmatter', () => {
    const adjacent = findFrontmatter('---\n---\n\nBody.\n')
    expect(adjacent).toMatchObject({ from: 0, to: 7, yamlFrom: 4, yamlTo: 4 })
    const blank = '---\n\n---\n\nBody.\n'
    const found = findFrontmatter(blank)
    expect(found?.to).toBe(8)
    expect(blank.slice(found?.yamlFrom, found?.yamlTo)).toBe('')
  })

  it('finds a Document that is only a frontmatter', () => {
    const text = '---\nname: demo\n---\n'
    expect(findFrontmatter(text)?.to).toBe(text.length - 1)
  })

  it('keeps blank lines and YAML that looks like Markdown inside it', () => {
    const text =
      '---\ndescription: |\n  # not a heading\n\n  - not a list\n```\n---\n\nBody.\n'
    const found = findFrontmatter(text)
    expect(text.slice(found?.yamlFrom, found?.yamlTo)).toBe(
      'description: |\n  # not a heading\n\n  - not a list\n```',
    )
  })

  describe('between two plain rules', () => {
    it('is not a frontmatter when the first line is prose', () => {
      expect(findFrontmatter('---\n\nIntro.\n\n---\n\nRest.\n')).toBeUndefined()
      expect(findFrontmatter('---\nJust a paragraph.\n---\n')).toBeUndefined()
      expect(findFrontmatter('---\nNote that: it works\n---\n')).toBeUndefined()
    })

    it('is not a frontmatter when the first line is a list item or a heading', () => {
      expect(findFrontmatter('---\n- one\n- two\n---\n')).toBeUndefined()
      expect(findFrontmatter('---\n## Heading\ntext\n---\n')).toBeUndefined()
    })

    it('is not a frontmatter when there are only comments', () => {
      expect(findFrontmatter('---\n# Title\n---\n')).toBeUndefined()
      expect(findFrontmatter('---\n# one\n\n  # two\n---\n')).toBeUndefined()
    })

    it('is not a frontmatter when comments are followed by prose', () => {
      expect(findFrontmatter('---\n# Title\nIntro.\n---\n')).toBeUndefined()
    })

    it('needs a space or the end of the line after the colon', () => {
      expect(findFrontmatter('---\nhttps://example.com\n---\n')).toBeUndefined()
      expect(findFrontmatter('---\nname:demo\n---\n')).toBeUndefined()
      expect(findFrontmatter('---\nname:\n---\n')).toBeDefined()
      expect(findFrontmatter('---\nname:\tdemo\n---\n')).toBeDefined()
    })
  })

  describe('real frontmatters', () => {
    it('opens with a comment line', () => {
      const text = '---\n# Managed by hand\nname: demo\n---\n\nBody.\n'
      expect(findFrontmatter(text)?.to).toBe(text.indexOf('\n\nBody.'))
    })

    it('opens with blank lines and comments', () => {
      const text = '---\n\n  # note\n# another\n\nname: demo\n---\n'
      expect(findFrontmatter(text)).toBeDefined()
    })

    it('has a quoted or hyphenated first key', () => {
      expect(findFrontmatter('---\n"name": demo\n---\n')).toBeDefined()
      expect(findFrontmatter("---\n'name': demo\n---\n")).toBeDefined()
      expect(findFrontmatter('---\nallowed-tools: Read\n---\n')).toBeDefined()
      expect(findFrontmatter('---\nnome-da-habilidade: x\n---\n')).toBeDefined()
    })

    it('is empty or only blank lines', () => {
      expect(findFrontmatter('---\n---\n')).toBeDefined()
      expect(findFrontmatter('---\n\n\n---\n')).toBeDefined()
      expect(findFrontmatter('---\n \t\n---\n')).toBeDefined()
    })

    it('has a first key with a block value', () => {
      const text = '---\ndescription: >\n  Prose: with a colon.\n---\n'
      expect(findFrontmatter(text)).toBeDefined()
    })
  })

  it('does not treat a lone CR as a line break', () => {
    expect(findFrontmatter('---\r\nname: demo\r\n---\r\n')).toBeUndefined()
  })
})

describe('touchesFrontmatter', () => {
  const frontmatter = findFrontmatter(SKILL)
  const end = frontmatter?.to ?? 0

  it('refuses a cursor inside it, including the end of the closing line', () => {
    expect(touchesFrontmatter(frontmatter, { from: 0, to: 0 })).toBe(true)
    expect(touchesFrontmatter(frontmatter, { from: 8, to: 8 })).toBe(true)
    expect(touchesFrontmatter(frontmatter, { from: end, to: end })).toBe(true)
  })

  it('refuses a range inside or overlapping it', () => {
    expect(touchesFrontmatter(frontmatter, { from: 4, to: 10 })).toBe(true)
    expect(touchesFrontmatter(frontmatter, { from: 4, to: end + 6 })).toBe(true)
    expect(touchesFrontmatter(frontmatter, { from: 0, to: SKILL.length })).toBe(
      true,
    )
  })

  it('allows a range that starts after it', () => {
    expect(
      touchesFrontmatter(frontmatter, { from: end + 1, to: end + 1 }),
    ).toBe(false)
    expect(
      touchesFrontmatter(frontmatter, { from: end + 2, to: end + 8 }),
    ).toBe(false)
  })

  it('allows a range that only starts where the frontmatter ends', () => {
    expect(touchesFrontmatter(frontmatter, { from: end, to: end + 8 })).toBe(
      false,
    )
  })

  it('allows anything when there is no frontmatter', () => {
    expect(touchesFrontmatter(undefined, { from: 0, to: 5 })).toBe(false)
  })
})

describe('blankFrontmatter', () => {
  it('blanks the frontmatter and keeps every offset', () => {
    const blanked = blankFrontmatter(SKILL)
    expect(blanked).toHaveLength(SKILL.length)
    expect(blanked.slice(findFrontmatter(SKILL)?.to)).toBe(
      SKILL.slice(findFrontmatter(SKILL)?.to),
    )
    expect(blanked.slice(0, findFrontmatter(SKILL)?.to).trim()).toBe('')
  })

  it('returns the text unchanged without a frontmatter', () => {
    const text = '# Title\n\nBody.\n'
    expect(blankFrontmatter(text)).toBe(text)
  })
})
