import { describe, expect, it } from 'vitest'
import type { LibraryListing, LibraryRoot } from './library'
import { isSkillOpen, skillCount, skillHoldingFile } from './library-view'
import type { Skill } from './scan-skills'

const skill = (folderName: string, overrides: Partial<Skill> = {}): Skill => ({
  realPath: `/skills/${folderName}`,
  folderName,
  root: '/skills',
  name: folderName,
  description: undefined,
  problem: undefined,
  files: [
    {
      path: `/skills/${folderName}/SKILL.md`,
      name: 'SKILL.md',
      isMarkdown: true,
    },
    {
      path: `/skills/${folderName}/notes.md`,
      name: 'notes.md',
      isMarkdown: true,
    },
    { path: `/skills/${folderName}/run.sh`, name: 'run.sh', isMarkdown: false },
  ],
  ...overrides,
})

const root = (
  skills: readonly Skill[],
  overrides: Partial<LibraryRoot> = {},
) => ({
  root: '/skills',
  label: '/skills',
  removable: false,
  readable: true,
  skills,
  ...overrides,
})

const LISTING: LibraryListing = [
  root([skill('pdf'), skill('git')]),
  root([skill('docs')], { root: '/other' }),
]

describe('skillCount', () => {
  it('adds the skills of every root', () => {
    expect(skillCount(LISTING)).toBe(3)
  })

  it('is zero for no roots', () => {
    expect(skillCount([])).toBe(0)
  })
})

describe('skillHoldingFile', () => {
  const opening = (path: string) => (candidate: string) => candidate === path

  it('finds the skill whose folder holds the open file', () => {
    expect(skillHoldingFile(LISTING, opening('/skills/git/notes.md'))).toBe(
      '/skills/git',
    )
    expect(skillHoldingFile(LISTING, opening('/skills/docs/SKILL.md'))).toBe(
      '/skills/docs',
    )
  })

  it('finds nothing for a file outside the Library', () => {
    expect(skillHoldingFile(LISTING, opening('/tmp/other.md'))).toBeUndefined()
  })

  it('finds nothing when no file is open', () => {
    expect(skillHoldingFile(LISTING, () => false)).toBeUndefined()
  })
})

describe('isSkillOpen', () => {
  it('follows the choice made on the skill', () => {
    expect(isSkillOpen({ '/skills/pdf': true }, '/skills/pdf', undefined)).toBe(
      true,
    )
    expect(
      isSkillOpen({ '/skills/pdf': false }, '/skills/pdf', '/skills/pdf'),
    ).toBe(false)
  })

  it('opens the skill holding the open file unless told otherwise', () => {
    expect(isSkillOpen({}, '/skills/pdf', '/skills/pdf')).toBe(true)
  })

  it('keeps the other skills closed', () => {
    expect(isSkillOpen({}, '/skills/git', '/skills/pdf')).toBe(false)
  })
})
