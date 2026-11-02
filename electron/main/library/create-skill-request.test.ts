import { describe, expect, it } from 'vitest'
import { parseCreateSkillRequest } from './create-skill-request'

const valid = { root: '/home/a/.claude/skills', name: 'pdf-processing' }

describe('parseCreateSkillRequest', () => {
  it('accepts an absolute root and a name', () => {
    expect(parseCreateSkillRequest(valid)).toEqual(valid)
  })

  it('leaves the name as sent, so the rules judge it', () => {
    expect(
      parseCreateSkillRequest({ ...valid, name: ' Not Valid/' })?.name,
    ).toBe(' Not Valid/')
  })

  it.each([
    ['a relative root', { ...valid, root: 'skills' }],
    ['an empty root', { ...valid, root: '' }],
    ['a NUL in the root', { ...valid, root: '/a\0b' }],
    ['a very long root', { ...valid, root: `/${'a'.repeat(5000)}` }],
    ['an empty name', { ...valid, name: '' }],
    ['a NUL in the name', { ...valid, name: 'a\0b' }],
    ['a very long name', { ...valid, name: 'a'.repeat(300) }],
    ['a name that is not text', { ...valid, name: 7 }],
    ['a root that is not text', { ...valid, root: ['/a'] }],
    ['a missing name', { root: valid.root }],
    ['a missing root', { name: valid.name }],
    ['an extra field', { ...valid, template: 'x' }],
    ['an extra path field', { ...valid, path: '/etc' }],
    ['a string', '/home/a/.claude/skills'],
    ['null', null],
    ['undefined', undefined],
    ['an array', [valid.root, valid.name]],
  ])('refuses %s', (_label, input) => {
    expect(parseCreateSkillRequest(input)).toBeNull()
  })
})
