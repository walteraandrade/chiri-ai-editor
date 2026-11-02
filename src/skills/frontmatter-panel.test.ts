import { describe, expect, it } from 'vitest'
import type { FrontmatterProblemRule } from './frontmatter-fields'
import {
  describeFrontmatterProblem,
  describeSkillProblem,
  type FrontmatterContext,
  type FrontmatterReport,
  inspectFrontmatter,
  isSameReport,
  problemsOfField,
  reportProblems,
} from './frontmatter-panel'
import {
  checkSkillFrontmatter,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type SkillProblem,
  type SkillRule,
} from './skill-frontmatter'

const SKILL_FILE: FrontmatterContext = {
  fileName: 'SKILL.md',
  folderName: undefined,
}

const NOTES_FILE: FrontmatterContext = {
  fileName: 'notes.md',
  folderName: undefined,
}

const NO_FILE: FrontmatterContext = { fileName: null, folderName: undefined }

const documentOf = (yaml: string): string =>
  `---\n${yaml}\n---\n\n# Title\n\nBody.\n`

const VALID = documentOf('name: demo\ndescription: Does a thing.')

const skillReport = (
  report: FrontmatterReport,
): Extract<FrontmatterReport, { kind: 'skill' }> => {
  if (report.kind !== 'skill') throw new Error(report.kind)
  return report
}

describe('inspectFrontmatter', () => {
  it('reads name and description of a SKILL.md with no problems', () => {
    expect(inspectFrontmatter(VALID, SKILL_FILE)).toEqual({
      kind: 'skill',
      name: 'demo',
      description: 'Does a thing.',
      present: true,
      problems: [],
    })
  })

  it('shows nothing for a document that is not a SKILL.md', () => {
    expect(inspectFrontmatter(VALID, NOTES_FILE)).toEqual({ kind: 'none' })
    expect(inspectFrontmatter(VALID, NO_FILE)).toEqual({ kind: 'none' })
    expect(inspectFrontmatter('# Plain\n', NOTES_FILE)).toEqual({
      kind: 'none',
    })
  })

  it('applies the skill rules to a SKILL.md only', () => {
    const text = documentOf('title: A post')
    expect(inspectFrontmatter(text, NOTES_FILE).kind).toBe('none')
    expect(
      skillReport(inspectFrontmatter(text, SKILL_FILE)).problems.map(
        ({ field }) => field,
      ),
    ).toEqual(['name', 'description'])
  })

  it('reports a SKILL.md with no frontmatter as missing name and description', () => {
    const report = skillReport(inspectFrontmatter('# Title\n', SKILL_FILE))
    expect(report.present).toBe(false)
    expect(report.name).toBe('')
    expect(report.description).toBe('')
    expect(report.problems).toEqual([
      { field: 'name', message: describeSkillProblem(missing('name')) },
      {
        field: 'description',
        message: describeSkillProblem(missing('description')),
      },
    ])
  })

  it('checks the name against the folder only when the folder is known', () => {
    const text = documentOf('name: demo\ndescription: Does a thing.')
    expect(skillReport(inspectFrontmatter(text, SKILL_FILE)).problems).toEqual(
      [],
    )
    expect(
      skillReport(
        inspectFrontmatter(text, { ...SKILL_FILE, folderName: 'demo' }),
      ).problems,
    ).toEqual([])
    const mismatch = skillReport(
      inspectFrontmatter(text, { ...SKILL_FILE, folderName: 'other' }),
    ).problems
    expect(mismatch).toHaveLength(1)
    expect(mismatch[0]?.field).toBe('name')
    expect(mismatch[0]?.message).toContain('"other"')
  })

  it('shows the values as the editor holds them', () => {
    const report = skillReport(
      inspectFrontmatter(
        documentOf('name: "  spaced  "\ndescription: |-\n  one\n  two'),
        SKILL_FILE,
      ),
    )
    expect(report.name).toBe('  spaced  ')
    expect(report.description).toBe('one\ntwo')
  })

  it('shows numbers and booleans as text and flags them', () => {
    const report = skillReport(
      inspectFrontmatter(
        documentOf('name: 123\ndescription: true'),
        SKILL_FILE,
      ),
    )
    expect(report.name).toBe('123')
    expect(report.description).toBe('true')
    expect(report.problems.map(({ field }) => field)).toEqual([
      'name',
      'description',
    ])
  })

  it('shows lists and maps as empty and flags them', () => {
    const report = skillReport(
      inspectFrontmatter(
        documentOf('name: [a, b]\ndescription:\n  key: value'),
        SKILL_FILE,
      ),
    )
    expect(report.name).toBe('')
    expect(report.description).toBe('')
    expect(report.problems).toHaveLength(2)
  })

  it('flags a name and a description over their limits', () => {
    const text = documentOf(
      `name: ${'a'.repeat(NAME_MAX_LENGTH + 1)}\ndescription: ${'d'.repeat(DESCRIPTION_MAX_LENGTH + 1)}`,
    )
    expect(
      skillReport(inspectFrontmatter(text, SKILL_FILE)).problems.map(
        ({ field }) => field,
      ),
    ).toEqual(['name', 'description'])
  })

  describe('a frontmatter that cannot be read', () => {
    it('reports a frontmatter that is not closed, in any document', () => {
      const text = '---\nname: demo\n\n# Title\n'
      expect(inspectFrontmatter(text, NOTES_FILE)).toEqual({
        kind: 'unreadable',
        skill: false,
        problems: [
          {
            field: null,
            message: describeFrontmatterProblem({
              rule: 'frontmatter-not-closed',
              message: 'frontmatter not closed',
            }),
          },
        ],
      })
      expect(inspectFrontmatter(text, SKILL_FILE)).toMatchObject({
        kind: 'unreadable',
        skill: true,
      })
    })

    it('reports a YAML syntax error with its line', () => {
      const text = documentOf('name: demo\ndescription: [unclosed')
      const report = inspectFrontmatter(text, NOTES_FILE)
      expect(report.kind).toBe('unreadable')
      if (report.kind !== 'unreadable') return
      expect(report.problems).toHaveLength(1)
      expect(report.problems[0]?.message).toMatch(/^YAML error on line \d+: /)
    })

    it('reports a --- block that is not YAML, in a SKILL.md only', () => {
      const text = '---\nthis is prose\n---\n\nText.\n'
      expect(inspectFrontmatter(text, NOTES_FILE)).toEqual({ kind: 'none' })
      expect(inspectFrontmatter(text, SKILL_FILE)).toMatchObject({
        kind: 'unreadable',
        skill: true,
      })
    })

    it('is quiet about a horizontal rule that is no frontmatter', () => {
      expect(inspectFrontmatter('---\n\nA rule above.\n', NOTES_FILE)).toEqual({
        kind: 'none',
      })
    })
  })
})

describe('describeSkillProblem', () => {
  const field = (rule: SkillRule): SkillProblem['field'] =>
    rule.startsWith('description') ? 'description' : 'name'

  const problemFor = (rule: SkillRule): SkillProblem => ({
    field: field(rule),
    rule,
    message: `message for ${rule}`,
  })

  const RULES: readonly SkillRule[] = [
    'name-missing',
    'name-not-text',
    'name-empty',
    'name-too-long',
    'description-missing',
    'description-not-text',
    'description-empty',
    'description-too-long',
    'name-not-lowercase',
    'name-invalid-characters',
    'name-edge-hyphen',
    'name-double-hyphen',
    'name-folder-mismatch',
  ]

  it('covers every rule the checker has', () => {
    const produced = new Set(
      [
        {},
        { name: 1, description: 1 },
        { name: '', description: '' },
        { name: 'A--b-/', description: 'x'.repeat(1025) },
        { name: 'a'.repeat(65), description: 'x' },
        { name: 'abc', description: 'x' },
      ].flatMap((fields) =>
        checkSkillFrontmatter(fields, 'folder').map(({ rule }) => rule),
      ),
    )
    for (const rule of produced) expect(RULES).toContain(rule)
  })

  it.each(RULES)('says what is wrong for %s', (rule) => {
    const text = describeSkillProblem(problemFor(rule))
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain(
      rule.startsWith('description') ? 'description' : 'name',
    )
  })

  it('tells where a missing field is used', () => {
    expect(describeSkillProblem(missing('description'))).toMatch(/decide when/i)
  })

  it('names the folder in a mismatch and how to fix it', () => {
    const text = describeSkillProblem({
      field: 'name',
      rule: 'name-folder-mismatch',
      message: 'name must match its folder name, "pdf"',
    })
    expect(text).toContain('"pdf"')
    expect(text).toMatch(/rename the folder/i)
  })

  it('keeps the counts of a length problem', () => {
    const [problem] = checkSkillFrontmatter({
      name: 'a'.repeat(70),
      description: 'x',
    })
    expect(problem && describeSkillProblem(problem)).toContain('70')
  })
})

describe('describeFrontmatterProblem', () => {
  const rules: readonly FrontmatterProblemRule[] = [
    'frontmatter-not-closed',
    'frontmatter-not-recognized',
    'yaml-syntax-error',
    'frontmatter-not-a-mapping',
  ]

  it.each(rules)('describes %s', (rule) => {
    expect(
      describeFrontmatterProblem({ rule, message: 'raw message' }).length,
    ).toBeGreaterThan(0)
  })

  it('puts the line and the YAML message of a syntax error', () => {
    expect(
      describeFrontmatterProblem({
        rule: 'yaml-syntax-error',
        message:
          'Flow sequence in block collection must be sufficiently indented',
        line: 4,
        column: 2,
      }),
    ).toBe(
      'YAML error on line 4: Flow sequence in block collection must be sufficiently indented',
    )
  })

  it('still describes a syntax error with no line', () => {
    expect(
      describeFrontmatterProblem({ rule: 'yaml-syntax-error', message: 'Bad' }),
    ).toBe('YAML error: Bad')
  })
})

describe('reportProblems and problemsOfField', () => {
  const broken = inspectFrontmatter('---\nname: demo\n', NOTES_FILE)
  const fields = inspectFrontmatter(
    documentOf('name: Demo\ndescription: ""'),
    SKILL_FILE,
  )

  it('lists the messages of a report in order', () => {
    expect(reportProblems(fields)).toHaveLength(2)
    expect(reportProblems(fields)[0]).toMatch(/lowercase/)
    expect(reportProblems(broken)).toHaveLength(1)
    expect(reportProblems({ kind: 'none' })).toEqual([])
    expect(reportProblems(inspectFrontmatter(VALID, SKILL_FILE))).toEqual([])
  })

  it('picks the problems of one field', () => {
    expect(problemsOfField(fields, 'name')).toHaveLength(1)
    expect(problemsOfField(fields, 'description')).toHaveLength(1)
    expect(problemsOfField(broken, 'name')).toEqual([])
    expect(problemsOfField({ kind: 'none' }, 'name')).toEqual([])
  })
})

describe('isSameReport', () => {
  it('is true for equal reports built twice', () => {
    expect(
      isSameReport(
        inspectFrontmatter(VALID, SKILL_FILE),
        inspectFrontmatter(VALID, SKILL_FILE),
      ),
    ).toBe(true)
  })

  it('is false when a value or a problem differs', () => {
    const other = documentOf('name: demo\ndescription: Another.')
    expect(
      isSameReport(
        inspectFrontmatter(VALID, SKILL_FILE),
        inspectFrontmatter(other, SKILL_FILE),
      ),
    ).toBe(false)
    expect(
      isSameReport(
        inspectFrontmatter(VALID, SKILL_FILE),
        inspectFrontmatter(VALID, NOTES_FILE),
      ),
    ).toBe(false)
  })
})

function missing(field: 'name' | 'description'): SkillProblem {
  return {
    field,
    rule: `${field}-missing`,
    message: `${field} is required`,
  }
}
