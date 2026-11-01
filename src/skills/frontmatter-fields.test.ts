import { describe, expect, it } from 'vitest'
import { findFrontmatter } from '../blocks/frontmatter'
import {
  type FrontmatterEdit,
  readFrontmatter,
  readYamlFields,
  setSkillFields,
} from './frontmatter-fields'

const BODY = '\n# Demo\n\nBody has name: nope and a rule.\n\n---\n\nAfter.\n'

const documentOf = (yaml: string): string => `---\n${yaml}\n---\n${BODY}`

const textOf = (edit: FrontmatterEdit): string => {
  if (!edit.ok) throw new Error(edit.problem.message)
  return edit.text
}

const edited = (text: string, values: Parameters<typeof setSkillFields>[1]) =>
  textOf(setSkillFields(text, values))

const fieldsOf = (text: string): Readonly<Record<string, unknown>> => {
  const reading = readFrontmatter(text)
  if (reading.kind !== 'present') throw new Error(reading.kind)
  return reading.fields
}

const bodyOf = (text: string): string =>
  text.slice(findFrontmatter(text)?.to ?? 0)

describe('readFrontmatter', () => {
  it('reads name and description', () => {
    expect(
      readFrontmatter(documentOf('name: demo\ndescription: Does a thing.')),
    ).toEqual({
      kind: 'present',
      fields: { name: 'demo', description: 'Does a thing.' },
    })
  })

  it('keeps the other keys as unknown values', () => {
    const fields = fieldsOf(
      documentOf(
        'name: demo\nlicense: MIT\nversion: 2\nallowed-tools:\n  - Read\n  - Write\nmetadata:\n  author: me\n  tags: [a, b]',
      ),
    )
    expect(fields).toEqual({
      name: 'demo',
      license: 'MIT',
      version: 2,
      'allowed-tools': ['Read', 'Write'],
      metadata: { author: 'me', tags: ['a', 'b'] },
    })
  })

  it('does not coerce name or description into text', () => {
    expect(fieldsOf(documentOf('name: 123\ndescription: true'))).toEqual({
      name: 123,
      description: true,
    })
    expect(fieldsOf(documentOf('name:\ndescription: [a]'))).toEqual({
      name: null,
      description: ['a'],
    })
  })

  it('reads block scalars, quotes and comments', () => {
    const fields = fieldsOf(
      documentOf(
        '# lead\nname: "demo" # trailing\ndescription: >\n  Folded\n  text: with a colon.\n',
      ),
    )
    expect(fields).toEqual({
      name: 'demo',
      description: 'Folded text: with a colon.\n',
    })
  })

  it('reads an empty frontmatter as no fields', () => {
    expect(readFrontmatter('---\n---\n\nBody.\n')).toEqual({
      kind: 'present',
      fields: {},
    })
    expect(readFrontmatter('---\n\n---\n')).toEqual({
      kind: 'present',
      fields: {},
    })
  })

  it('reports a Document without frontmatter as absent', () => {
    expect(readFrontmatter('# Title\n\nBody.\n')).toEqual({ kind: 'absent' })
    expect(readFrontmatter('')).toEqual({ kind: 'absent' })
  })

  it('treats a rule followed by prose as absent, not as unclosed', () => {
    expect(readFrontmatter('---\n\nIntro.\n\nMore.\n')).toEqual({
      kind: 'absent',
    })
    expect(readFrontmatter('---\n')).toEqual({ kind: 'absent' })
    expect(readFrontmatter('---\n# only a comment\n')).toEqual({
      kind: 'absent',
    })
  })

  it('reports an unclosed frontmatter', () => {
    const reading = readFrontmatter('---\nname: demo\n\n# Demo\n\nBody.\n')
    expect(reading).toMatchObject({
      kind: 'invalid',
      problem: {
        rule: 'frontmatter-not-closed',
        message: 'frontmatter not closed',
      },
    })
  })

  it('reports an unclosed frontmatter at the very end of the Document', () => {
    expect(readFrontmatter('---\nname: demo')).toMatchObject({
      kind: 'invalid',
      problem: { rule: 'frontmatter-not-closed' },
    })
    expect(readFrontmatter('---\nname: demo\n')).toMatchObject({
      kind: 'invalid',
      problem: { rule: 'frontmatter-not-closed' },
    })
  })

  it('reports a malformed closing delimiter as unclosed', () => {
    expect(readFrontmatter('---\nname: demo\n----\n\nBody.\n')).toMatchObject({
      kind: 'invalid',
      problem: { rule: 'frontmatter-not-closed' },
    })
  })

  it('reports a YAML syntax error with its Document line', () => {
    const reading = readFrontmatter(
      documentOf('name: demo\ndescription: [unclosed\nlicense: MIT'),
    )
    expect(reading.kind).toBe('invalid')
    if (reading.kind !== 'invalid') return
    expect(reading.problem.rule).toBe('yaml-syntax-error')
    expect(reading.problem.message).not.toBe('')
    expect(reading.problem.message).not.toContain('\n')
    expect(reading.problem.line).toBeGreaterThanOrEqual(3)
    expect(reading.problem.column).toBeGreaterThanOrEqual(1)
  })

  it('reports a bad indentation as a syntax error', () => {
    expect(
      readFrontmatter(
        documentOf('name: demo\n  description: nested\nlicense: x'),
      ),
    ).toMatchObject({
      kind: 'invalid',
      problem: { rule: 'yaml-syntax-error' },
    })
  })

  it('reports a duplicate key as a syntax error', () => {
    expect(
      readFrontmatter(documentOf('name: one\ndescription: x\nname: two')),
    ).toMatchObject({
      kind: 'invalid',
      problem: { rule: 'yaml-syntax-error', line: 4 },
    })
  })

  it('reports a tab used as indentation', () => {
    expect(
      readFrontmatter(documentOf('name: demo\nmetadata:\n\tauthor: me')),
    ).toMatchObject({
      kind: 'invalid',
      problem: { rule: 'yaml-syntax-error' },
    })
  })

  it('does not throw on an alias bomb', () => {
    const yaml = [
      'a: &a [x, x, x, x, x, x, x, x, x, x]',
      'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]',
      'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]',
      'd: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]',
      'e: &e [*d, *d, *d, *d, *d, *d, *d, *d, *d, *d]',
    ].join('\n')
    expect(() => readFrontmatter(documentOf(yaml))).not.toThrow()
    expect(readFrontmatter(documentOf(yaml)).kind).toBe('invalid')
  })

  it('reads fields after a body that looks like frontmatter', () => {
    expect(fieldsOf(documentOf('name: demo'))).toEqual({ name: 'demo' })
  })
})

describe('readYamlFields', () => {
  it('reads a mapping', () => {
    expect(readYamlFields('name: demo\nn: 1')).toEqual({
      ok: true,
      fields: { name: 'demo', n: 1 },
    })
  })

  it('reads empty YAML and comments as no fields', () => {
    expect(readYamlFields('')).toEqual({ ok: true, fields: {} })
    expect(readYamlFields('# only a comment\n')).toEqual({
      ok: true,
      fields: {},
    })
  })

  it('reports a sequence as not a mapping', () => {
    expect(readYamlFields('- a\n- b')).toMatchObject({
      ok: false,
      problem: { rule: 'frontmatter-not-a-mapping' },
    })
  })

  it('reports a bare scalar as not a mapping', () => {
    expect(readYamlFields('just text')).toMatchObject({
      ok: false,
      problem: { rule: 'frontmatter-not-a-mapping' },
    })
  })

  it('numbers lines from the given first line', () => {
    const at = (firstLine?: number) => {
      const reading = readYamlFields('a: 1\nb: [', firstLine)
      return reading.ok ? undefined : reading.problem.line
    }
    expect(at()).toBe(2)
    expect(at(2)).toBe(3)
  })
})

describe('setSkillFields', () => {
  describe('replacing values', () => {
    it('changes only the frontmatter', () => {
      const text = documentOf('name: old\ndescription: Old text.')
      const result = edited(text, {
        name: 'new-name',
        description: 'New text.',
      })
      expect(result).toBe(documentOf('name: new-name\ndescription: New text.'))
      expect(bodyOf(result)).toBe(bodyOf(text))
    })

    it('changes one field and leaves the other line alone', () => {
      const text = documentOf('name: old\ndescription: Old text.')
      expect(edited(text, { name: 'new' })).toBe(
        documentOf('name: new\ndescription: Old text.'),
      )
      expect(edited(text, { description: 'New.' })).toBe(
        documentOf('name: old\ndescription: New.'),
      )
    })

    it('returns the same text when nothing changes', () => {
      const text = documentOf(
        "# lead\nname:   'demo'   # keep\ndescription: >\n  Folded\n  text\nextra:\n- a\n- b",
      )
      expect(edited(text, {})).toBe(text)
      expect(edited(text, { name: 'demo' })).toBe(text)
      expect(edited(text, { name: 'demo', description: 'Folded text\n' })).toBe(
        text,
      )
    })

    it('keeps the order of the keys', () => {
      const text = documentOf('license: MIT\ndescription: d\nname: n\nz: 1')
      expect(edited(text, { name: 'x', description: 'y' })).toBe(
        documentOf('license: MIT\ndescription: y\nname: x\nz: 1'),
      )
    })

    it('keeps comments, blank lines and the other keys byte for byte', () => {
      const yaml = [
        '# Managed by hand',
        '',
        'name: old # the name',
        '',
        '# about the description',
        'description: Old text. # why',
        'license:    MIT   # spacing',
        'allowed-tools:',
        '- Read',
        '- Write',
        'notes: first line',
        '  second line',
        "quoted: 'single'",
        'metadata:',
        '    author:   me',
        '# end comment',
      ].join('\n')
      const result = edited(documentOf(yaml), {
        name: 'new-name',
        description: 'New text.',
      })
      expect(result).toBe(
        documentOf(
          yaml
            .replace('name: old # the name', 'name: new-name # the name')
            .replace(
              'description: Old text. # why',
              'description: New text. # why',
            ),
        ),
      )
    })

    it('replaces a multi-line plain value entirely', () => {
      const text = documentOf(
        'name: n\ndescription: line one\n  line two\nz: 1',
      )
      expect(edited(text, { description: 'short' })).toBe(
        documentOf('name: n\ndescription: short\nz: 1'),
      )
    })

    it('replaces a value that sits on the next line', () => {
      const text = documentOf(
        'name: n\ndescription:\n  text on next line\nz: 1',
      )
      expect(edited(text, { description: 'short' })).toBe(
        documentOf('name: n\ndescription: short\nz: 1'),
      )
    })

    it('fills an empty value', () => {
      expect(edited(documentOf('name:\ndescription: d'), { name: 'n' })).toBe(
        documentOf('name: n\ndescription: d'),
      )
      expect(
        edited(documentOf('name: n\ndescription:'), { description: 'd' }),
      ).toBe(documentOf('name: n\ndescription: d'))
    })

    it('keeps a comment on an empty value', () => {
      expect(
        edited(documentOf('name: # fill me\ndescription: d'), { name: 'n' }),
      ).toBe(documentOf('name: n # fill me\ndescription: d'))
    })

    it('replaces a value that is not text', () => {
      const text = documentOf('name: 123\ndescription: [a, b]\nz: 1')
      expect(edited(text, { name: 'n', description: 'd' })).toBe(
        documentOf('name: n\ndescription: d\nz: 1'),
      )
    })

    it('replaces a block sequence value', () => {
      const text = documentOf('name: n\ndescription:\n  - a\n  - b\nz: 1')
      expect(edited(text, { description: 'd' })).toBe(
        documentOf('name: n\ndescription: d\nz: 1'),
      )
    })

    it('keeps a quoted key', () => {
      const text = documentOf('"name": old\n\'description\': old')
      expect(edited(text, { name: 'n', description: 'd' })).toBe(
        documentOf('"name": n\n\'description\': d'),
      )
    })

    it('keeps the blank lines after a block value', () => {
      const text = documentOf('name: n\ndescription: |\n  old\n\n\nz: 1')
      expect(edited(text, { description: 'new' })).toBe(
        documentOf('name: n\ndescription: |-\n  new\n\n\nz: 1'),
      )
    })

    it('replaces a block value at the end of the frontmatter', () => {
      const text = documentOf('name: n\ndescription: >-\n  old\n  text')
      expect(edited(text, { description: 'new' })).toBe(
        documentOf('name: n\ndescription: >-\n  new'),
      )
    })
  })

  describe('styles', () => {
    it('keeps quotes around a single-line value', () => {
      expect(
        edited(documentOf('name: "old"\ndescription: \'old\''), {
          name: 'new',
          description: 'new',
        }),
      ).toBe(documentOf('name: "new"\ndescription: \'new\''))
    })

    it('keeps the folded and literal block styles', () => {
      expect(
        edited(documentOf('name: n\ndescription: >\n  old\n  text'), {
          description: 'new text',
        }),
      ).toBe(documentOf('name: n\ndescription: >-\n  new text'))
      expect(
        edited(documentOf('name: n\ndescription: |\n  old'), {
          description: 'new text',
        }),
      ).toBe(documentOf('name: n\ndescription: |-\n  new text'))
    })

    it('writes a multi-line value as a literal block', () => {
      expect(
        edited(documentOf('name: n\ndescription: old'), {
          description: 'line one\nline two',
        }),
      ).toBe(documentOf('name: n\ndescription: |-\n  line one\n  line two'))
    })

    it('switches a quoted value to a literal block when it gets lines', () => {
      expect(
        edited(documentOf('name: n\ndescription: "old"'), {
          description: 'a\nb',
        }),
      ).toBe(documentOf('name: n\ndescription: |-\n  a\n  b'))
    })

    it('keeps a folded block when the value gets lines', () => {
      const result = edited(documentOf('name: n\ndescription: >\n  old'), {
        description: 'a\nb',
      })
      expect(fieldsOf(result).description).toBe('a\nb')
      expect(result).toContain('description: >')
    })

    it('keeps a trailing newline in a block value', () => {
      const result = edited(documentOf('name: n\ndescription: old'), {
        description: 'line one\nline two\n',
      })
      expect(result).toBe(
        documentOf('name: n\ndescription: |\n  line one\n  line two'),
      )
      expect(fieldsOf(result).description).toBe('line one\nline two\n')
    })

    it('does not fold a long value', () => {
      const long = `${'word '.repeat(60)}end`
      const result = edited(documentOf('name: n\ndescription: old'), {
        description: long,
      })
      expect(result).toBe(documentOf(`name: n\ndescription: ${long}`))
    })

    it('does not fold a long quoted value', () => {
      const long = `${'word: '.repeat(60)}end`
      const result = edited(documentOf('name: n\ndescription: old'), {
        description: long,
      })
      expect(result).toBe(documentOf(`name: n\ndescription: "${long}"`))
    })

    it('moves a trailing comment into the header of a block value', () => {
      const result = edited(documentOf('name: n\ndescription: old # why'), {
        description: 'a\nb',
      })
      expect(result).toBe(
        documentOf('name: n\ndescription: |- # why\n  a\n  b'),
      )
    })

    it('keeps a header comment of a block value', () => {
      const result = edited(
        documentOf('name: n\ndescription: > # why\n  old\nz: 1'),
        { description: 'new' },
      )
      expect(result).toBe(
        documentOf('name: n\ndescription: >- # why\n  new\nz: 1'),
      )
    })

    it('keeps a comment between the key and its value', () => {
      const result = edited(
        documentOf('name: n\ndescription:\n  # note\n  old\nz: 1'),
        { description: 'new' },
      )
      expect(result).toContain('# note')
      expect(fieldsOf(result)).toEqual({
        name: 'n',
        description: 'new',
        z: 1,
      })
    })

    it('keeps an anchor so its aliases still resolve', () => {
      const result = edited(documentOf('name: n\ndescription: &d old\nz: *d'), {
        description: 'new',
      })
      expect(result).toBe(documentOf('name: n\ndescription: &d new\nz: *d'))
      expect(fieldsOf(result)).toEqual({
        name: 'n',
        description: 'new',
        z: 'new',
      })
    })

    it('does not let a block value absorb the blank lines after it', () => {
      const text = documentOf('name: n\ndescription: |\n  old\n\nz: 1')
      const result = edited(text, { description: 'new\n\n' })
      expect(fieldsOf(result)).toEqual({
        name: 'n',
        description: 'new\n\n',
        z: 1,
      })
      expect(result).toContain('\nz: 1\n---')
    })

    it('does not let a block value keep a whitespace-only last line', () => {
      const text = documentOf('name: n\ndescription: old\n\nz: 1')
      const result = edited(text, { description: 'a\n\t\n' })
      expect(fieldsOf(result)).toEqual({
        name: 'n',
        description: 'a\n\t\n',
        z: 1,
      })
    })

    it('writes a whitespace-only value in quotes, not as a block', () => {
      const result = edited(documentOf('name: n\ndescription: |\n  old'), {
        description: ' ',
      })
      expect(result).toBe(documentOf('name: n\ndescription: " "'))
    })

    it('falls back to a JSON string when no block or quote reads back', () => {
      const value = '\u0000null\n\n\n\n~\n\n\n\n\n \n-?true'
      const result = edited(documentOf('z: 1'), { description: value })
      expect(result).toBe(
        documentOf(
          'description: "\\u0000null\\n\\n\\n\\n~\\n\\n\\n\\n\\n \\n-?true"\nz: 1',
        ),
      )
      expect(fieldsOf(result)).toEqual({ description: value, z: 1 })
    })

    it('escapes Unicode line breaks in the JSON fallback', () => {
      const value = '\u0000null\n\n\n\n~\n\n\n\n\n \n-?true\u2028\u0085\u2029'
      const result = edited(documentOf('z: 1'), { description: value })
      expect(result).toContain('-?true\\u2028\\u0085\\u2029"')
      expect(fieldsOf(result)).toEqual({ description: value, z: 1 })
    })
  })

  describe('special characters', () => {
    const tricky = [
      'Does: a thing',
      'Has a # hash',
      'Ends with colon:',
      'Starts # with hash',
      '# starts with a hash',
      '- starts with a dash',
      '-',
      '?',
      '? question',
      ': colon',
      "it's here",
      'say "hi"',
      'both \' and "',
      '[bracket] and {brace}',
      '[start',
      '{start',
      '*alias',
      '&anchor',
      '!tag',
      '|pipe',
      '>gt',
      '%percent',
      '@at',
      '`tick`',
      '\\backslash',
      'tab\there',
      ' leading space',
      'trailing space ',
      '  both  ',
      'true',
      'false',
      'null',
      '~',
      '123',
      '1.5',
      '0x1F',
      '2024-01-01',
      'yes',
      'no',
      '---',
      '...',
      '--- text',
      'café 日本語 \u{1F600}',
      'x: y: z',
      'a, b, c',
      'url https://example.com/a#b',
      '',
      ' ',
    ]

    it.each(tricky)('round-trips %j in a plain value', (value) => {
      const result = edited(documentOf('name: n\ndescription: old\nz: 1'), {
        description: value,
      })
      expect(fieldsOf(result)).toEqual({ name: 'n', description: value, z: 1 })
      expect(bodyOf(result)).toBe(`\n${BODY}`)
    })

    it.each(tricky)('round-trips %j in a quoted value', (value) => {
      const result = edited(documentOf('name: "n"\ndescription: "old"\nz: 1'), {
        name: value,
        description: value,
      })
      expect(fieldsOf(result)).toEqual({
        name: value,
        description: value,
        z: 1,
      })
    })

    it.each(tricky)('round-trips %j in a block value', (value) => {
      const result = edited(
        documentOf('name: n\ndescription: |\n  old\nz: 1'),
        {
          description: value,
        },
      )
      expect(fieldsOf(result)).toEqual({ name: 'n', description: value, z: 1 })
    })

    it.each(tricky)('round-trips %j when inserted', (value) => {
      const result = edited(documentOf('z: 1'), {
        name: value,
        description: value,
      })
      expect(fieldsOf(result)).toEqual({
        name: value,
        description: value,
        z: 1,
      })
    })

    const multiline = [
      'a\nb',
      'a\n\nb',
      'a\n\n\nb',
      '\nleading',
      '\n\nleading',
      'trailing\n',
      'trailing\n\n',
      'trailing\n\n\n',
      '\n',
      '\n\n',
      'a\n',
      '  indented first\nsecond',
      'first\n  indented second',
      'first\n\tindented with tab',
      'first \nsecond',
      'first\n second',
      'first\n  \nthird',
      '# not a comment\nb',
      'a: b\nc: d',
      '- a\n- b',
      '---\ntext\n---',
      'key: value\n\n  nested: x',
      'a\u2028b',
      'a\u0085b',
      'quote " and \' here\nnext',
      'trailing space \nnext ',
    ]

    it.each(multiline)('round-trips %j as a multi-line value', (value) => {
      const result = edited(documentOf('name: n\ndescription: old\nz: 1'), {
        description: value,
      })
      expect(fieldsOf(result)).toEqual({ name: 'n', description: value, z: 1 })
      expect(bodyOf(result)).toBe(`\n${BODY}`)
    })

    it.each(multiline)('round-trips %j over a folded block', (value) => {
      const result = edited(
        documentOf('name: n\ndescription: >\n  old\nz: 1'),
        {
          description: value,
        },
      )
      expect(fieldsOf(result)).toEqual({ name: 'n', description: value, z: 1 })
    })

    it.each(multiline)('round-trips %j when it is last', (value) => {
      const result = edited(documentOf('name: n\ndescription: old'), {
        description: value,
      })
      expect(fieldsOf(result)).toEqual({ name: 'n', description: value })
      expect(bodyOf(result)).toBe(`\n${BODY}`)
    })

    it.each(multiline)('round-trips %j after a trailing comment', (value) => {
      const result = edited(
        documentOf('name: n\ndescription: old # why\nz: 1'),
        {
          description: value,
        },
      )
      expect(fieldsOf(result)).toEqual({ name: 'n', description: value, z: 1 })
    })

    it('round-trips random values', () => {
      const pieces = [
        'a',
        'Z',
        '1',
        ' ',
        '  ',
        '\n',
        '\n\n',
        ':',
        ': ',
        '#',
        ' #',
        '"',
        "'",
        '-',
        '- ',
        '?',
        '[',
        ']',
        '{',
        '}',
        ',',
        '&',
        '*',
        '!',
        '|',
        '>',
        '%',
        '@',
        '`',
        '\\',
        '\t',
        'é',
        '日',
        '\u{1F600}',
        '~',
        '---',
        '...',
        '\u0007',
        '\u2028',
        '\u0085',
        '\ufeff',
      ]
      let seed = 20260
      const next = (): number => {
        seed = (seed * 1664525 + 1013904223) % 4294967296
        return seed / 4294967296
      }
      const random = (): string =>
        Array.from(
          { length: Math.floor(next() * 14) },
          () => pieces[Math.floor(next() * pieces.length)],
        ).join('')
      const bases = [
        'name: n\ndescription: old\nz: 1',
        'name: "n"\ndescription: "old" # c\nz: 1',
        "name: 'n'\ndescription: 'old'",
        'name: n\ndescription: |\n  old\n\nz: 1',
        'name: n\ndescription: >-\n  old\n  more\n# end',
        'description:\nname:',
        'z: 1',
      ]
      Array.from({ length: 800 }, (_, index) => ({
        base: bases[index % bases.length] ?? '',
        name: random(),
        description: random(),
      })).forEach(({ base, name, description }) => {
        const text = documentOf(base)
        const result = edited(text, { name, description })
        const fields = fieldsOf(result)
        expect([name, description, fields.name, fields.description]).toEqual([
          name,
          description,
          name,
          description,
        ])
        expect(bodyOf(result)).toBe(bodyOf(text))
        expect(fields.z).toBe(fieldsOf(text).z)
      })
    })
  })

  describe('adding missing fields', () => {
    it('adds name first and description after it', () => {
      expect(
        edited(documentOf('license: MIT'), { name: 'n', description: 'd' }),
      ).toBe(documentOf('name: n\ndescription: d\nlicense: MIT'))
    })

    it('adds only the missing name', () => {
      expect(edited(documentOf('description: d\nz: 1'), { name: 'n' })).toBe(
        documentOf('name: n\ndescription: d\nz: 1'),
      )
    })

    it('adds the missing description right after the name', () => {
      expect(
        edited(documentOf('name: n # the name\nz: 1'), { description: 'd' }),
      ).toBe(documentOf('name: n # the name\ndescription: d\nz: 1'))
    })

    it('adds the description after a multi-line name value', () => {
      expect(
        edited(documentOf('name: >\n  n\n  m\n\nz: 1'), { description: 'd' }),
      ).toBe(documentOf('name: >\n  n\n  m\ndescription: d\n\nz: 1'))
    })

    it('adds the description when the name is the last key', () => {
      expect(edited(documentOf('name: n'), { description: 'd' })).toBe(
        documentOf('name: n\ndescription: d'),
      )
      expect(edited(documentOf('name: n\n'), { description: 'd' })).toBe(
        documentOf('name: n\ndescription: d\n'),
      )
    })

    it('adds a description before the other keys when there is no name', () => {
      expect(edited(documentOf('z: 1'), { description: 'd' })).toBe(
        documentOf('description: d\nz: 1'),
      )
    })

    it('adds both after the name in one pass when only one is missing', () => {
      expect(
        edited(documentOf('name: old\nz: 1'), {
          name: 'new',
          description: 'd',
        }),
      ).toBe(documentOf('name: new\ndescription: d\nz: 1'))
    })

    it('keeps the comments of the first key', () => {
      const result = edited(documentOf('# about z\nz: 1'), { name: 'n' })
      expect(result).toBe(documentOf('name: n\n# about z\nz: 1'))
    })

    it('fills an empty frontmatter', () => {
      expect(
        edited('---\n---\n\nBody.\n', { name: 'n', description: 'd' }),
      ).toBe('---\nname: n\ndescription: d\n---\n\nBody.\n')
      expect(edited('---\n\n---\n', { name: 'n' })).toBe(
        '---\nname: n\n\n---\n',
      )
    })

    it('fills a Document that is only a frontmatter', () => {
      expect(edited('---\nz: 1\n---', { name: 'n' })).toBe(
        '---\nname: n\nz: 1\n---',
      )
    })

    it('adds a multi-line description as a literal block', () => {
      expect(edited(documentOf('name: n\nz: 1'), { description: 'a\nb' })).toBe(
        documentOf('name: n\ndescription: |-\n  a\n  b\nz: 1'),
      )
    })

    it('keeps the delimiters, blanks included', () => {
      const text = '---  \nname: n\n---\t\n\nBody.\n'
      expect(edited(text, { name: 'm', description: 'd' })).toBe(
        '---  \nname: m\ndescription: d\n---\t\n\nBody.\n',
      )
    })
  })

  describe('a Document without frontmatter', () => {
    it('creates one at the top', () => {
      expect(
        edited('# Title\n\nBody.\n', { name: 'n', description: 'd' }),
      ).toBe('---\nname: n\ndescription: d\n---\n\n# Title\n\nBody.\n')
    })

    it('keeps the whole original text after the new frontmatter', () => {
      const original = '\n\n  # Title\n\nBody.'
      const result = edited(original, { name: 'n', description: 'd' })
      expect(result.endsWith(original)).toBe(true)
      expect(fieldsOf(result)).toEqual({ name: 'n', description: 'd' })
    })

    it('creates one for an empty Document', () => {
      expect(edited('', { name: 'n', description: 'd' })).toBe(
        '---\nname: n\ndescription: d\n---\n',
      )
    })

    it('creates only the fields it is given', () => {
      expect(edited('Body.\n', { description: 'd' })).toBe(
        '---\ndescription: d\n---\n\nBody.\n',
      )
    })

    it('creates a frontmatter above a rule followed by prose', () => {
      const original = '---\n\nIntro.\n'
      const result = edited(original, { name: 'n' })
      expect(result).toBe('---\nname: n\n---\n\n---\n\nIntro.\n')
      expect(fieldsOf(result)).toEqual({ name: 'n' })
      expect(result.endsWith(original)).toBe(true)
    })

    it('creates nothing when there is nothing to write', () => {
      expect(edited('# Title\n', {})).toBe('# Title\n')
    })

    it('escapes what needs it in a new frontmatter', () => {
      const result = edited('Body.\n', {
        name: 'n',
        description: 'Does: a thing # really\nsecond line',
      })
      expect(fieldsOf(result)).toEqual({
        name: 'n',
        description: 'Does: a thing # really\nsecond line',
      })
    })
  })

  describe('refusing', () => {
    it('refuses an unclosed frontmatter and creates nothing', () => {
      expect(
        setSkillFields('---\nname: demo\n\n# Demo\n', { name: 'x' }),
      ).toMatchObject({
        ok: false,
        problem: { rule: 'frontmatter-not-closed' },
      })
    })

    it('refuses a frontmatter with a syntax error', () => {
      expect(
        setSkillFields(documentOf('name: [broken\nz: 1'), { name: 'x' }),
      ).toMatchObject({
        ok: false,
        problem: { rule: 'yaml-syntax-error' },
      })
    })

    it('refuses even when nothing would change', () => {
      expect(setSkillFields(documentOf('name: [broken'), {})).toMatchObject({
        ok: false,
      })
    })

    it('refuses a frontmatter with a duplicate key', () => {
      expect(
        setSkillFields(documentOf('name: a\nname: b'), { name: 'x' }),
      ).toMatchObject({
        ok: false,
        problem: { rule: 'yaml-syntax-error' },
      })
    })
  })

  describe('round trip', () => {
    it('parse, edit, parse gives the new values and the same body', () => {
      const text = documentOf(
        '# lead\nname: old\ndescription: >\n  Old\n  text\nlicense: MIT',
      )
      const before = fieldsOf(text)
      const result = edited(text, {
        name: 'new-name',
        description: 'New: description # with specials\nand a second line',
      })
      expect(fieldsOf(result)).toEqual({
        ...before,
        name: 'new-name',
        description: 'New: description # with specials\nand a second line',
      })
      expect(bodyOf(result)).toBe(bodyOf(text))
    })

    it('editing twice equals editing once with the last values', () => {
      const text = documentOf('name: a\ndescription: b')
      const twice = edited(edited(text, { name: 'x' }), { name: 'y' })
      expect(twice).toBe(edited(text, { name: 'y' }))
    })

    it('is stable: setting the values it just wrote changes nothing', () => {
      const values = { name: 'n', description: 'one: two\nthree # four' }
      const once = edited(documentOf('z: 1'), values)
      expect(edited(once, values)).toBe(once)
    })

    it('leaves a frontmatter that is only blank lines before the body valid', () => {
      const result = edited('---\n\n\n---\n# Body\n', { name: 'n' })
      expect(fieldsOf(result)).toEqual({ name: 'n' })
      expect(bodyOf(result)).toBe('\n# Body\n')
    })
  })
})
