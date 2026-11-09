import { describe, expect, it } from 'vitest'
import type { LibraryListing, LibraryRoot } from './library'
import {
  isWordStart,
  MAX_SEARCH_RESULTS,
  searchLibrary,
} from './library-search'
import type { Skill } from './scan-skills'

const skill = (
  name: string,
  files: readonly string[] = [],
  description?: string,
  folder = name,
): Skill => ({
  realPath: `/skills/${folder}`,
  folderName: folder,
  root: '/skills',
  name,
  description,
  problem: undefined,
  files: ['SKILL.md', ...files].map((file) => ({
    path: `/skills/${folder}/${file}`,
    name: file,
    isMarkdown: file.toLowerCase().endsWith('.md'),
  })),
})

const root = (skills: readonly Skill[]): LibraryRoot => ({
  root: '/skills',
  label: '~/.claude/skills',
  removable: false,
  readable: true,
  skills,
})

const listing = (...skills: readonly Skill[]): LibraryListing => [root(skills)]

const labels = (results: ReturnType<typeof searchLibrary>) =>
  results.map(({ kind, label }) => `${kind}:${label}`)

describe('isWordStart', () => {
  it('starts a word at the beginning of the text', () => {
    expect(isWordStart('pr-format', 0)).toBe(true)
  })

  it.each(['-', '_', '/', ' ', '.', '(', ',', '"'])(
    'starts a word after %j',
    (separator) => {
      expect(isWordStart(`a${separator}b`, 2)).toBe(true)
    },
  )

  it('does not start a word inside a word', () => {
    expect(isWordStart('improve', 2)).toBe(false)
  })
})

describe('searchLibrary', () => {
  it('returns nothing for empty or blank text', () => {
    const roots = listing(skill('pr-format'))
    expect(searchLibrary(roots, '')).toEqual([])
    expect(searchLibrary(roots, '   ')).toEqual([])
  })

  it('puts a name that starts with the text before a word that starts with it', () => {
    const roots = listing(skill('git-pr'), skill('pr-format'), skill('print'))
    expect(labels(searchLibrary(roots, 'pr'))).toEqual([
      'skill:pr-format',
      'skill:print',
      'skill:git-pr',
    ])
  })

  it('puts name matches before file paths and file paths before descriptions', () => {
    const roots = listing(
      skill('review', [], 'Checks a pr body'),
      skill('docs', ['evals/pr-case/prompt.md']),
      skill('pr-format'),
    )
    expect(labels(searchLibrary(roots, 'pr'))).toEqual([
      'skill:pr-format',
      'file:evals/pr-case/prompt.md',
      'skill:review',
    ])
  })

  it('matches case-insensitively', () => {
    const roots = listing(skill('PR-Format'))
    expect(labels(searchLibrary(roots, 'pr-F'))).toEqual(['skill:PR-Format'])
  })

  it('keeps the Library order among equal matches', () => {
    const roots = listing(skill('prb'), skill('pra'), skill('prc'))
    expect(labels(searchLibrary(roots, 'pr'))).toEqual([
      'skill:prb',
      'skill:pra',
      'skill:prc',
    ])
  })

  it('keeps the Library order across roots', () => {
    const first = { ...root([skill('prx', [], undefined, 'a')]), root: '/a' }
    const second = { ...root([skill('pry', [], undefined, 'b')]), root: '/b' }
    expect(labels(searchLibrary([first, second], 'pr'))).toEqual([
      'skill:prx',
      'skill:pry',
    ])
  })

  it('does not match inside a word of a name', () => {
    expect(searchLibrary(listing(skill('improve')), 'pr')).toEqual([])
  })

  it('matches a file path by the start of a word in it', () => {
    const roots = listing(skill('docs', ['evals/a/graders/before.md']))
    expect(labels(searchLibrary(roots, 'graders'))).toEqual([
      'file:evals/a/graders/before.md',
    ])
    expect(labels(searchLibrary(roots, 'graders/bef'))).toEqual([
      'file:evals/a/graders/before.md',
    ])
    expect(searchLibrary(roots, 'raders')).toEqual([])
  })

  it('does not match inside a word of a file path', () => {
    const roots = listing(skill('docs', ['evals/improve.md']))
    expect(searchLibrary(roots, 'pr')).toEqual([])
  })

  it('matches a description by the start of a word only', () => {
    const roots = listing(skill('a', [], 'Improve the pr text'))
    expect(labels(searchLibrary(roots, 'pr'))).toEqual(['skill:a'])
    expect(searchLibrary(roots, 'prove')).toEqual([])
  })

  it('skips SKILL.md and files Desafinado cannot open as file rows', () => {
    const roots = listing(skill('docs', ['notes.txt', 'run.sh', 'extra.md']))
    expect(searchLibrary(roots, 'skill')).toEqual([])
    expect(searchLibrary(roots, 'notes')).toEqual([])
    expect(labels(searchLibrary(roots, 'extra'))).toEqual(['file:extra.md'])
  })

  it('opens a Skill through its SKILL.md and a file through itself', () => {
    const roots = listing(skill('pr-format', ['evals/pr/prompt.md']))
    const [first, second] = searchLibrary(roots, 'pr')
    expect(first).toMatchObject({
      kind: 'skill',
      path: '/skills/pr-format/SKILL.md',
    })
    expect(second).toMatchObject({
      kind: 'file',
      path: '/skills/pr-format/evals/pr/prompt.md',
    })
  })

  it('names the Skill a file row belongs to', () => {
    const roots = listing(skill('docs', ['extra.md']))
    expect(searchLibrary(roots, 'extra')[0]).toMatchObject({
      context: 'docs',
    })
  })

  it('gives the range to underline in the name', () => {
    const roots = listing(skill('git-pr'))
    expect(searchLibrary(roots, 'PR')[0]).toMatchObject({
      label: 'git-pr',
      labelMatch: { start: 4, end: 6 },
      detailMatch: null,
    })
  })

  it('gives the range to underline in a file path', () => {
    const roots = listing(skill('docs', ['evals/a/prompt.md']))
    expect(searchLibrary(roots, 'prom')[0]).toMatchObject({
      label: 'evals/a/prompt.md',
      labelMatch: { start: 8, end: 12 },
    })
  })

  it('gives the range to underline in a description', () => {
    const roots = listing(skill('a', [], 'Writes the PR body'))
    expect(searchLibrary(roots, 'pr')[0]).toMatchObject({
      label: 'a',
      labelMatch: null,
      detail: 'Writes the PR body',
      detailMatch: { start: 11, end: 13 },
    })
  })

  it('shows the description under a Skill found by name, without underline', () => {
    const roots = listing(skill('pr-format', [], 'Formats'))
    expect(searchLibrary(roots, 'pr')[0]).toMatchObject({
      detail: 'Formats',
      detailMatch: null,
    })
  })

  it('collapses line breaks in a description', () => {
    const roots = listing(skill('a', [], 'one\ntwo pr'))
    expect(searchLibrary(roots, 'pr')[0]?.detail).toBe('one two pr')
    expect(searchLibrary(roots, 'pr')[0]?.detailMatch).toEqual({
      start: 8,
      end: 10,
    })
  })

  it('collapses mixed whitespace and blank lines around line breaks', () => {
    const roots = listing(
      skill('a', [], '  one \r\n \n\t two  three\n\n pr\n '),
    )
    expect(searchLibrary(roots, 'pr')[0]?.detail).toBe('one two  three pr')
  })

  it('returns at most 12 rows', () => {
    const many = Array.from({ length: 30 }, (_, index) => skill(`pr-${index}`))
    expect(searchLibrary(listing(...many), 'pr')).toHaveLength(
      MAX_SEARCH_RESULTS,
    )
    expect(MAX_SEARCH_RESULTS).toBe(12)
  })

  it('keeps the best matches when it cuts at 12', () => {
    const noise = Array.from({ length: 20 }, (_, index) =>
      skill(`x-${index}`, [], 'a pr thing'),
    )
    const roots = listing(...noise, skill('pr-last'))
    expect(searchLibrary(roots, 'pr')[0]?.label).toBe('pr-last')
  })

  it('lists a Skill once even if two roots reach it', () => {
    const one = root([skill('pr')])
    const two = { ...root([skill('pr')]), root: '/b' }
    expect(searchLibrary([one, two], 'pr')).toHaveLength(1)
  })

  it.each(['(', ')', ',', '"', "'"])(
    'starts a description word after %j',
    (mark) => {
      const roots = listing(skill('a', [], `see${mark}pr text`))
      expect(searchLibrary(roots, 'pr')[0]?.detailMatch).toEqual({
        start: 4,
        end: 6,
      })
    },
  )

  it('keeps ranges on the original text when lower-casing changes its length', () => {
    const roots = listing(skill('İpr-x'))
    expect(searchLibrary(roots, 'pr-')).toEqual([])
    const named = listing(skill('İstanbul-pr'))
    expect(searchLibrary(named, 'pr')[0]).toMatchObject({
      label: 'İstanbul-pr',
      labelMatch: { start: 9, end: 11 },
    })
  })

  it('trims the text', () => {
    expect(labels(searchLibrary(listing(skill('pr')), '  pr '))).toEqual([
      'skill:pr',
    ])
  })
})
