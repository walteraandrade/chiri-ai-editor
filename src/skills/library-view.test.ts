import { describe, expect, it } from 'vitest'
import type { LibraryListing, LibraryRoot } from './library'
import {
  isSkillOpen,
  sameLibrary,
  skillCount,
  skillFileLabel,
  skillHoldingFile,
} from './library-view'
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

describe('skillFileLabel', () => {
  const nested = skill('pdf-tools', {
    name: 'pdf-tools',
    files: [
      {
        path: '/skills/pdf-tools/SKILL.md',
        name: 'SKILL.md',
        isMarkdown: true,
      },
      {
        path: '/real/forms.md',
        name: 'references/forms.md',
        isMarkdown: true,
      },
    ],
  })
  const listing: LibraryListing = [root([skill('git'), nested])]
  const opening = (path: string) => (candidate: string) => candidate === path

  it('is the skill name and the file inside the skill', () => {
    expect(skillFileLabel(listing, opening('/skills/pdf-tools/SKILL.md'))).toBe(
      'pdf-tools / SKILL.md',
    )
  })

  it('keeps the path inside the skill for a nested file', () => {
    expect(skillFileLabel(listing, opening('/real/forms.md'))).toBe(
      'pdf-tools / references/forms.md',
    )
  })

  it('uses the frontmatter name, not the folder name', () => {
    const renamed: LibraryListing = [
      root([skill('pdf', { name: 'pdf-processing' })]),
    ]
    expect(skillFileLabel(renamed, opening('/skills/pdf/SKILL.md'))).toBe(
      'pdf-processing / SKILL.md',
    )
  })

  it('is undefined for a file outside the Library', () => {
    expect(skillFileLabel(listing, opening('/tmp/other.md'))).toBeUndefined()
  })

  it('is undefined while the Library is not loaded', () => {
    expect(skillFileLabel([], opening('/skills/pdf-tools/SKILL.md'))).toBe(
      undefined,
    )
  })
})

describe('sameLibrary', () => {
  const snapshot = (
    skills: readonly Skill[],
    problem: string | null = null,
  ) => ({
    roots: [root(skills)],
    problem,
  })

  it('is true for the same listing read twice', () => {
    expect(
      sameLibrary(snapshot([skill('pdf')]), snapshot([skill('pdf')])),
    ).toBe(true)
  })

  it('is false when a skill was added, removed or renamed', () => {
    expect(sameLibrary(snapshot([skill('pdf')]), snapshot([]))).toBe(false)
    expect(
      sameLibrary(
        snapshot([skill('pdf')]),
        snapshot([skill('pdf'), skill('docx')]),
      ),
    ).toBe(false)
    expect(
      sameLibrary(
        snapshot([skill('pdf')]),
        snapshot([skill('pdf', { name: 'pdf tools' })]),
      ),
    ).toBe(false)
  })

  it('is false when only a file of a skill changed', () => {
    expect(
      sameLibrary(
        snapshot([skill('pdf')]),
        snapshot([skill('pdf', { files: [] })]),
      ),
    ).toBe(false)
  })

  it('is false when the problem with the root list changed', () => {
    expect(
      sameLibrary(
        snapshot([skill('pdf')]),
        snapshot([skill('pdf')], 'Could not read library-roots.json'),
      ),
    ).toBe(false)
  })
})
