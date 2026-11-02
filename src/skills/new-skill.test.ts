import { describe, expect, it } from 'vitest'
import type { LibraryRoot } from './library'
import {
  firstWritableRoot,
  newSkillDraft,
  newSkillRequest,
  writableRoots,
} from './new-skill'
import type { Skill } from './scan-skills'

const skill = (folderName: string): Skill => ({
  realPath: `/skills/${folderName}`,
  folderName,
  root: '/skills',
  name: folderName,
  description: undefined,
  problem: undefined,
  files: [],
})

const root = (overrides: Partial<LibraryRoot> = {}): LibraryRoot => ({
  root: '/home/u/.claude/skills',
  label: '~/.claude/skills',
  removable: false,
  readable: true,
  skills: [skill('pdf')],
  ...overrides,
})

describe('writableRoots', () => {
  it('keeps the roots that could be read, in order', () => {
    const a = root()
    const gone = root({ root: '/gone', readable: false })
    const b = root({ root: '/b', label: '/b' })
    expect(writableRoots([a, gone, b])).toEqual([a, b])
  })
})

describe('firstWritableRoot', () => {
  it('is the first root that could be read', () => {
    const b = root({ root: '/b' })
    expect(
      firstWritableRoot([root({ root: '/gone', readable: false }), b]),
    ).toBe(b)
  })

  it('is undefined when no root can be read', () => {
    expect(firstWritableRoot([])).toBeUndefined()
    expect(firstWritableRoot([root({ readable: false })])).toBeUndefined()
  })
})

describe('newSkillDraft', () => {
  it('is not ready and says nothing while the name is empty', () => {
    expect(newSkillDraft('', root())).toEqual({
      problems: [],
      announcement: '',
      ready: false,
      location: null,
    })
    expect(newSkillDraft('   ', root()).problems).toEqual([])
    expect(newSkillDraft('   ', root()).ready).toBe(false)
  })

  it('is ready for a valid name and shows where the file will be', () => {
    expect(newSkillDraft('pdf-processing', root())).toEqual({
      problems: [],
      announcement: '',
      ready: true,
      location: '~/.claude/skills/pdf-processing/SKILL.md',
    })
  })

  it('uses the trimmed name', () => {
    expect(newSkillDraft('  pdf-processing ', root()).location).toBe(
      '~/.claude/skills/pdf-processing/SKILL.md',
    )
  })

  it('applies the same rules as the frontmatter check', () => {
    const draft = newSkillDraft('PDF--tool-', root())
    expect(draft.ready).toBe(false)
    expect(draft.problems).toEqual([
      'name must be lowercase',
      'name must not start or end with a hyphen',
      'name must not contain consecutive hyphens',
    ])
  })

  it('says how long a name is when it is too long', () => {
    expect(newSkillDraft('a'.repeat(70), root()).problems).toEqual([
      'name has 70 characters; the limit is 64',
    ])
  })

  describe('announcement, which a screen reader hears', () => {
    const announced = (name: string) => newSkillDraft(name, root()).announcement

    it('names the kinds of problem, with no numbers', () => {
      expect(announced('PDF--tool-')).toBe(
        'Name problems: name is not lowercase; name starts or ends with a hyphen; name has consecutive hyphens',
      )
      expect(announced('a'.repeat(70))).toBe('Name problems: name is too long')
    })

    it('stays the same while only the numbers change', () => {
      expect(announced('a'.repeat(70))).toBe(announced('a'.repeat(71)))
    })

    it('changes when a kind of problem appears or goes', () => {
      expect(announced('p')).toBe('')
      expect(announced('P')).not.toBe(announced('p'))
      expect(announced('Pd')).toBe(announced('P'))
      expect(announced('Pd f')).not.toBe(announced('Pd'))
    })

    it('says a skill with the name is there', () => {
      expect(announced('pdf')).toBe(
        'Name problems: a skill folder with this name already exists',
      )
    })
  })

  it('refuses a name another skill in the folder already has', () => {
    const draft = newSkillDraft('pdf', root())
    expect(draft.ready).toBe(false)
    expect(draft.problems).toEqual([
      'A skill folder named "pdf" already exists in ~/.claude/skills',
    ])
  })

  it('is not ready without a folder to create in', () => {
    const draft = newSkillDraft('pdf-processing', undefined)
    expect(draft.ready).toBe(false)
    expect(draft.location).toBeNull()
  })
})

describe('newSkillRequest', () => {
  it('sends the root and the trimmed name', () => {
    expect(newSkillRequest(' pdf ', root())).toEqual({
      root: '/home/u/.claude/skills',
      name: 'pdf',
    })
  })
})
