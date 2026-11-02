import { describe, expect, it } from 'vitest'
import { findFrontmatter } from '../blocks/frontmatter'
import {
  applyChanges,
  type FieldEditPlan,
  planFieldEdit,
  type TextChange,
} from './frontmatter-edit'
import { readFrontmatter } from './frontmatter-fields'

const BODY = '\n# Demo\n\nBody has name: nope and a rule.\n\n---\n\nAfter.\n'

const AFTER_CLOSING = `\n${BODY}`

const SKILL = `---\nname: demo\ndescription: Does a thing.\nlicense: MIT\n---\n${BODY}`

const changesOf = (plan: FieldEditPlan): readonly TextChange[] => {
  if (plan.kind !== 'change') throw new Error(plan.kind)
  return plan.changes
}

const edited = (
  text: string,
  values: Parameters<typeof planFieldEdit>[1],
): string => applyChanges(text, changesOf(planFieldEdit(text, values)))

const fieldsOf = (text: string): Readonly<Record<string, unknown>> => {
  const reading = readFrontmatter(text)
  if (reading.kind !== 'present') throw new Error(reading.kind)
  return reading.fields
}

describe('applyChanges', () => {
  it('applies changes given in the coordinates of the original text', () => {
    expect(
      applyChanges('abcdef', [
        { from: 4, to: 5, insert: 'X' },
        { from: 1, to: 2, insert: 'YY' },
      ]),
    ).toBe('aYYcdXf')
  })

  it('returns the text when there is nothing to apply', () => {
    expect(applyChanges('abc', [])).toBe('abc')
  })
})

describe('planFieldEdit', () => {
  it('changes only the value of the field', () => {
    const changes = changesOf(planFieldEdit(SKILL, { name: 'renamed' }))
    expect(changes).toHaveLength(1)
    expect(applyChanges(SKILL, changes)).toBe(
      SKILL.replace('name: demo', 'name: renamed'),
    )
    expect(SKILL.slice(changes[0]?.from, changes[0]?.to)).toContain('demo')
    expect(SKILL.slice(changes[0]?.from, changes[0]?.to)).not.toContain(
      'description',
    )
  })

  it('leaves the other keys, their order and the body byte-identical', () => {
    const next = edited(SKILL, { description: 'Does another thing.' })
    expect(next).toBe(SKILL.replace('Does a thing.', 'Does another thing.'))
    expect(next.slice(findFrontmatter(next)?.to)).toBe(
      SKILL.slice(findFrontmatter(SKILL)?.to),
    )
  })

  it('keeps every change inside the frontmatter', () => {
    for (const { from, to } of changesOf(
      planFieldEdit(SKILL, { name: 'a', description: 'b' }),
    )) {
      expect(from).toBeGreaterThanOrEqual(
        findFrontmatter(SKILL)?.yamlFrom ?? Number.NaN,
      )
      expect(to).toBeLessThanOrEqual(
        SKILL.indexOf('\n---', findFrontmatter(SKILL)?.yamlFrom) + 1,
      )
    }
  })

  it('edits both fields in one plan, in the coordinates of the original', () => {
    const changes = changesOf(
      planFieldEdit(SKILL, { name: 'x', description: 'Y.' }),
    )
    expect(changes).toHaveLength(2)
    expect(changes[0]?.to).toBeLessThanOrEqual(changes[1]?.from ?? Number.NaN)
    const next = applyChanges(SKILL, changes)
    expect(fieldsOf(next)).toMatchObject({ name: 'x', description: 'Y.' })
    expect(next.slice(findFrontmatter(next)?.to)).toBe(AFTER_CLOSING)
  })

  it('keeps the YAML valid for values that need quoting', () => {
    const tricky = [
      'a: b',
      '# not a comment',
      '- item',
      '"quoted"',
      'true',
      '1',
    ]
    for (const value of tricky) {
      const next = edited(SKILL, { description: value })
      expect(fieldsOf(next).description).toBe(value)
      expect(fieldsOf(next).name).toBe('demo')
    }
  })

  it('keeps the YAML valid for a multi-line description', () => {
    const value = 'First line.\nSecond line.'
    const next = edited(SKILL, { description: value })
    expect(fieldsOf(next).description).toBe(value)
    expect(next.slice(findFrontmatter(next)?.to)).toBe(AFTER_CLOSING)
  })

  it('keeps the YAML valid for an empty value', () => {
    const next = edited(SKILL, { name: '' })
    expect(fieldsOf(next).name).toBe('')
    expect(fieldsOf(next).license).toBe('MIT')
  })

  it('is unchanged when the value is the same', () => {
    expect(planFieldEdit(SKILL, { name: 'demo' })).toEqual({
      kind: 'unchanged',
    })
    expect(planFieldEdit(SKILL, {})).toEqual({ kind: 'unchanged' })
  })

  describe('a document with no frontmatter', () => {
    it('adds it with one insertion at the start', () => {
      const plain = '# Title\n\nText.\n'
      expect(changesOf(planFieldEdit(plain, { name: 'demo' }))).toEqual([
        { from: 0, to: 0, insert: '---\nname: demo\n---\n\n' },
      ])
      expect(edited(plain, { name: 'demo' })).toBe(
        '---\nname: demo\n---\n\n# Title\n\nText.\n',
      )
    })

    it('does not reuse the first character of a body that starts with a dash', () => {
      const body = '- item\n'
      expect(changesOf(planFieldEdit(body, { name: 'x' }))).toEqual([
        { from: 0, to: 0, insert: '---\nname: x\n---\n\n' },
      ])
      expect(edited(body, { name: 'x' })).toBe('---\nname: x\n---\n\n- item\n')
    })

    it('does not reuse the start of a body that opens with three dashes or a key', () => {
      for (const body of ['---x\n', 'name: y\n', '> quote\n']) {
        const next = edited(body, { name: 'x' })
        expect(next).toBe(`---\nname: x\n---\n\n${body}`)
        expect(fieldsOf(next)).toEqual({ name: 'x' })
      }
    })
  })

  it('adds a missing field next to the others, with a pure insertion', () => {
    const text = `---\nname: demo\n---\n${BODY}`
    const changes = changesOf(planFieldEdit(text, { description: 'Does it.' }))
    expect(changes).toHaveLength(1)
    expect(changes[0]?.from).toBe(changes[0]?.to)
    const next = applyChanges(text, changes)
    expect(fieldsOf(next)).toEqual({ name: 'demo', description: 'Does it.' })
    expect(next.slice(findFrontmatter(next)?.to)).toBe(AFTER_CLOSING)
  })

  it.each([
    ['frontmatter not closed', '---\nname: demo\n\n# Title\n'],
    ['frontmatter not recognized', '---\nthis is prose\n---\n\nText.\n'],
    ['yaml error', '---\nname: [unclosed\n---\n\nText.\n'],
  ])('refuses a document with %s', (_label, text) => {
    expect(planFieldEdit(text, { name: 'demo' }).kind).toBe('refused')
  })

  it('names the reason it refused', () => {
    expect(
      planFieldEdit('---\nname: demo\n\n# Title\n', { name: 'x' }),
    ).toEqual({
      kind: 'refused',
      problem: {
        rule: 'frontmatter-not-closed',
        message: 'frontmatter not closed',
      },
    })
  })
})
