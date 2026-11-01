import { describe, expect, it } from 'vitest'
import {
  MAX_TEXT_CHARS,
  parsePathRequest,
  parseSaveAsRequest,
  parseSaveRequest,
} from './requests'

describe('parsePathRequest', () => {
  it('accepts an absolute path', () => {
    expect(parsePathRequest('/home/a/skills/x/SKILL.md')).toBe(
      '/home/a/skills/x/SKILL.md',
    )
  })

  it.each([
    ['a relative path', 'skills/x/SKILL.md'],
    ['an empty string', ''],
    ['a NUL byte', '/home/a/x\0.md'],
    ['a very long path', `/${'a'.repeat(5000)}.md`],
    ['a number', 7],
    ['null', null],
    ['an object', { path: '/x.md' }],
    ['undefined', undefined],
  ])('refuses %s', (_label, value) => {
    expect(parsePathRequest(value)).toBeNull()
  })
})

describe('parseSaveRequest', () => {
  const valid = { path: '/home/a/SKILL.md', text: '# A\n', expected: '# A\n' }

  it('accepts a path with the new and the last known text', () => {
    expect(parseSaveRequest(valid)).toEqual(valid)
  })

  it('accepts empty texts', () => {
    expect(
      parseSaveRequest({ ...valid, text: '', expected: '' }),
    ).not.toBeNull()
  })

  it.each([
    ['a missing field', { path: valid.path, text: valid.text }],
    ['a relative path', { ...valid, path: 'SKILL.md' }],
    ['a non-string text', { ...valid, text: 3 }],
    ['an extra field', { ...valid, mode: 0o777 }],
    [
      'a text over the limit',
      { ...valid, text: 'a'.repeat(MAX_TEXT_CHARS + 1) },
    ],
    ['null', null],
    ['a string', '/home/a/SKILL.md'],
  ])('refuses %s', (_label, value) => {
    expect(parseSaveRequest(value)).toBeNull()
  })
})

describe('parseSaveAsRequest', () => {
  it('accepts a text and a suggested name', () => {
    expect(
      parseSaveAsRequest({ text: '# A\n', suggestedName: 'a.md' }),
    ).toEqual({ text: '# A\n', suggestedName: 'a.md' })
  })

  it('keeps only the last segment of the suggested name', () => {
    expect(
      parseSaveAsRequest({ text: '', suggestedName: '../../etc/cron.d/x.md' }),
    ).toEqual({ text: '', suggestedName: 'x.md' })
  })

  it.each([
    ['an empty name', { text: '', suggestedName: '' }],
    ['a name that is only separators', { text: '', suggestedName: '///' }],
    ['a NUL in the name', { text: '', suggestedName: 'a\0.md' }],
    ['a non-string text', { text: 1, suggestedName: 'a.md' }],
    ['an extra field', { text: '', suggestedName: 'a.md', path: '/x' }],
  ])('refuses %s', (_label, value) => {
    expect(parseSaveAsRequest(value)).toBeNull()
  })
})
