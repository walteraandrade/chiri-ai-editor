import { describe, expect, it } from 'vitest'
import {
  defaultRoots,
  displayPath,
  parseStoredRoots,
  serializeRoots,
  withoutRoot,
  withRoot,
} from './roots'

describe('defaultRoots', () => {
  it('are the Claude Code and shared agent skill folders under home', () => {
    expect(defaultRoots('/home/walter')).toEqual([
      '/home/walter/.claude/skills',
      '/home/walter/.agents/skills',
    ])
  })
})

describe('displayPath', () => {
  it('shortens a path under home to ~', () => {
    expect(displayPath('/home/walter/.claude/skills', '/home/walter')).toBe(
      '~/.claude/skills',
    )
  })

  it('shows home itself as ~', () => {
    expect(displayPath('/home/walter', '/home/walter')).toBe('~')
  })

  it('keeps a path outside home', () => {
    expect(displayPath('/srv/app/.claude/skills', '/home/walter')).toBe(
      '/srv/app/.claude/skills',
    )
  })

  it('does not shorten a sibling that shares the prefix', () => {
    expect(displayPath('/home/walter2/skills', '/home/walter')).toBe(
      '/home/walter2/skills',
    )
  })
})

describe('serializeRoots and parseStoredRoots', () => {
  it('round-trip the project roots', () => {
    const roots = ['/repo/a/.claude/skills', '/repo/b/.claude/skills']
    expect(parseStoredRoots(serializeRoots(roots))).toEqual(roots)
  })

  it('end the file with a newline', () => {
    expect(serializeRoots([]).endsWith('\n')).toBe(true)
  })

  it.each([
    ['not JSON', '{'],
    ['an array', '[]'],
    ['a missing field', '{}'],
    ['a field of the wrong type', '{"projectRoots":"/repo"}'],
    ['empty text', ''],
    ['a relative path', '{"projectRoots":["/a","relative"]}'],
    ['a non-string entry', '{"projectRoots":["/a",3]}'],
    ['an empty entry', '{"projectRoots":["/a",""]}'],
    ['a path with a NUL', '{"projectRoots":["/c\\u0000d"]}'],
  ])(
    'are unreadable for %s, so nothing is read as "no roots"',
    (_name, text) => {
      expect(parseStoredRoots(text)).toBeNull()
    },
  )

  it('read an empty list as no roots', () => {
    expect(parseStoredRoots('{"projectRoots":[]}')).toEqual([])
  })

  it('drop repeated roots', () => {
    expect(parseStoredRoots('{"projectRoots":["/a","/b","/a"]}')).toEqual([
      '/a',
      '/b',
    ])
  })
})

describe('withRoot and withoutRoot', () => {
  it('append a new root last', () => {
    expect(withRoot(['/a'], '/b')).toEqual(['/a', '/b'])
  })

  it('do not repeat a root', () => {
    expect(withRoot(['/a'], '/a')).toEqual(['/a'])
  })

  it('remove one root and keep the order of the rest', () => {
    expect(withoutRoot(['/a', '/b', '/c'], '/b')).toEqual(['/a', '/c'])
  })

  it('leave the roots alone when the one to remove is not there', () => {
    expect(withoutRoot(['/a'], '/x')).toEqual(['/a'])
  })
})
