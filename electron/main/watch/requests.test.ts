import { describe, expect, it } from 'vitest'
import { parseWatchRequest } from './requests'

describe('parseWatchRequest', () => {
  it('accepts the absolute path of a Markdown file', () => {
    expect(parseWatchRequest('/skills/pdf/SKILL.md')).toEqual({
      path: '/skills/pdf/SKILL.md',
    })
    expect(parseWatchRequest('/notes/a.markdown')).toEqual({
      path: '/notes/a.markdown',
    })
  })

  it('accepts null, which stops watching the open file', () => {
    expect(parseWatchRequest(null)).toEqual({ path: null })
  })

  it.each([
    ['a relative path', 'skills/pdf/SKILL.md'],
    ['an empty path', ''],
    ['a path with a NUL', '/skills/pdf/SKILL.md\0.png'],
    ['a file that is not Markdown', '/skills/pdf/run.sh'],
    ['a very long path', `/${'a'.repeat(5000)}.md`],
    ['a number', 7],
    ['an object', { path: '/skills/pdf/SKILL.md' }],
    ['undefined', undefined],
  ])('refuses %s', (_label, input) => {
    expect(parseWatchRequest(input)).toBeNull()
  })
})
