import { describe, expect, it } from 'vitest'
import { findFrontmatter } from '../blocks/frontmatter'
import {
  applyChange,
  changeBetween,
  type FieldEditPlan,
  planFieldEdit,
  type TextChange,
} from './frontmatter-edit'
import { readFrontmatter } from './frontmatter-fields'

const BODY = '\n# Demo\n\nBody has name: nope and a rule.\n\n---\n\nAfter.\n'

const AFTER_CLOSING = `\n${BODY}`

const SKILL = `---\nname: demo\ndescription: Does a thing.\nlicense: MIT\n---\n${BODY}`

const changeOf = (plan: FieldEditPlan): TextChange => {
  if (plan.kind !== 'change') throw new Error(plan.kind)
  return plan.change
}

const fieldsOf = (text: string): Readonly<Record<string, unknown>> => {
  const reading = readFrontmatter(text)
  if (reading.kind !== 'present') throw new Error(reading.kind)
  return reading.fields
}

describe('changeBetween', () => {
  it.each([
    ['', 'abc'],
    ['abc', ''],
    ['abc', 'abc!'],
    ['abc', '!abc'],
    ['abcd', 'abXd'],
    ['aaa', 'aa'],
    ['aa', 'aaa'],
    ['abab', 'ab'],
    ['name: a\n', 'name: ab\n'],
    ['x😀y', 'x😁y'],
  ])('describes %j → %j so applying it gives the new text', (before, after) => {
    const change = changeBetween(before, after)
    expect(change).not.toBeNull()
    expect(applyChange(before, change as TextChange)).toBe(after)
  })

  it('is null when nothing differs', () => {
    expect(changeBetween('same', 'same')).toBeNull()
    expect(changeBetween('', '')).toBeNull()
  })

  it('covers only the differing middle', () => {
    expect(changeBetween('name: abc\n', 'name: aXc\n')).toEqual({
      from: 7,
      to: 8,
      insert: 'X',
    })
  })

  it('never overlaps the shared prefix and suffix', () => {
    expect(changeBetween('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' })
  })
})

describe('planFieldEdit', () => {
  it('changes only the value of the field', () => {
    const change = changeOf(planFieldEdit(SKILL, { name: 'renamed' }))
    expect(applyChange(SKILL, change)).toBe(
      SKILL.replace('name: demo', 'name: renamed'),
    )
    expect(SKILL.slice(change.from, change.to)).toBe('demo')
  })

  it('leaves the other keys, their order and the body byte-identical', () => {
    const next = applyChange(
      SKILL,
      changeOf(planFieldEdit(SKILL, { description: 'Does another thing.' })),
    )
    expect(next).toBe(SKILL.replace('Does a thing.', 'Does another thing.'))
    expect(next.slice(findFrontmatter(next)?.to)).toBe(
      SKILL.slice(findFrontmatter(SKILL)?.to),
    )
  })

  it('keeps every change inside the frontmatter', () => {
    const frontmatter = findFrontmatter(SKILL)
    const { from, to } = changeOf(
      planFieldEdit(SKILL, { name: 'a', description: 'b' }),
    )
    expect(from).toBeGreaterThanOrEqual(frontmatter?.yamlFrom ?? Number.NaN)
    expect(to).toBeLessThanOrEqual(frontmatter?.yamlTo ?? Number.NaN)
  })

  it('edits both fields in one change', () => {
    const next = applyChange(
      SKILL,
      changeOf(planFieldEdit(SKILL, { name: 'x', description: 'Y.' })),
    )
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
      const next = applyChange(
        SKILL,
        changeOf(planFieldEdit(SKILL, { description: value })),
      )
      expect(fieldsOf(next).description).toBe(value)
      expect(fieldsOf(next).name).toBe('demo')
    }
  })

  it('keeps the YAML valid for a multi-line description', () => {
    const value = 'First line.\nSecond line.'
    const next = applyChange(
      SKILL,
      changeOf(planFieldEdit(SKILL, { description: value })),
    )
    expect(fieldsOf(next).description).toBe(value)
    expect(next.slice(findFrontmatter(next)?.to)).toBe(AFTER_CLOSING)
  })

  it('keeps the YAML valid for an empty value', () => {
    const next = applyChange(
      SKILL,
      changeOf(planFieldEdit(SKILL, { name: '' })),
    )
    expect(fieldsOf(next).name).toBe('')
    expect(fieldsOf(next).license).toBe('MIT')
  })

  it('is unchanged when the value is the same', () => {
    expect(planFieldEdit(SKILL, { name: 'demo' })).toEqual({
      kind: 'unchanged',
    })
    expect(planFieldEdit(SKILL, {})).toEqual({ kind: 'unchanged' })
  })

  it('adds frontmatter above a document that has none', () => {
    const plain = '# Title\n\nText.\n'
    const plan = planFieldEdit(plain, { name: 'demo' })
    const change = changeOf(plan)
    expect(change.from).toBe(0)
    expect(change.to).toBe(0)
    const next = applyChange(plain, change)
    expect(fieldsOf(next)).toEqual({ name: 'demo' })
    expect(next.endsWith(plain)).toBe(true)
  })

  it('adds a missing field next to the others', () => {
    const text = `---\nname: demo\n---\n${BODY}`
    const next = applyChange(
      text,
      changeOf(planFieldEdit(text, { description: 'Does a thing.' })),
    )
    expect(fieldsOf(next)).toEqual({
      name: 'demo',
      description: 'Does a thing.',
    })
    expect(next.slice(findFrontmatter(next)?.to)).toBe(AFTER_CLOSING)
  })

  it.each([
    ['frontmatter not closed', '---\nname: demo\n\n# Title\n'],
    ['frontmatter not recognized', '---\nthis is prose\n---\n\nText.\n'],
    ['yaml error', '---\nname: [unclosed\n---\n\nText.\n'],
  ])('refuses a document with %s', (_label, text) => {
    const plan = planFieldEdit(text, { name: 'demo' })
    expect(plan.kind).toBe('refused')
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
