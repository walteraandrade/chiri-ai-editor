import { describe, expect, it } from 'vitest'
import {
  AGENT_SKILLS_SPEC_URL,
  checkSkillFrontmatter,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type SkillRule,
} from './skill-frontmatter'

const VALID = {
  name: 'pdf-processing',
  description: 'Extracts text from PDFs.',
}

const rulesOf = (
  fields: Readonly<Record<string, unknown>>,
  folderName?: string,
): readonly SkillRule[] =>
  checkSkillFrontmatter(fields, folderName).map((problem) => problem.rule)

describe('limits', () => {
  it('takes them from the Agent Skills specification', () => {
    expect(AGENT_SKILLS_SPEC_URL).toBe('https://agentskills.io/specification')
    expect(NAME_MAX_LENGTH).toBe(64)
    expect(DESCRIPTION_MAX_LENGTH).toBe(1024)
  })
})

describe('checkSkillFrontmatter', () => {
  it('has no problems for a valid name and description', () => {
    expect(checkSkillFrontmatter(VALID)).toEqual([])
    expect(checkSkillFrontmatter(VALID, 'pdf-processing')).toEqual([])
  })

  it('ignores fields it has no rule for', () => {
    expect(
      checkSkillFrontmatter({
        ...VALID,
        license: 42,
        metadata: { version: 1 },
        'allowed-tools': ['Read'],
      }),
    ).toEqual([])
  })

  it('reports each problem with its field, rule and a message', () => {
    expect(checkSkillFrontmatter({})).toEqual([
      { field: 'name', rule: 'name-missing', message: 'name is required' },
      {
        field: 'description',
        rule: 'description-missing',
        message: 'description is required',
      },
    ])
  })

  it('lists name problems before description problems', () => {
    expect(rulesOf({ name: 'Bad Name', description: '' })).toEqual([
      'name-not-lowercase',
      'name-invalid-characters',
      'description-empty',
    ])
  })
})

describe('description', () => {
  it('is missing when absent, undefined or null', () => {
    expect(rulesOf({ name: 'a' })).toEqual(['description-missing'])
    expect(rulesOf({ name: 'a', description: undefined })).toEqual([
      'description-missing',
    ])
    expect(rulesOf({ name: 'a', description: null })).toEqual([
      'description-missing',
    ])
  })

  it('is empty when blank', () => {
    expect(rulesOf({ name: 'a', description: '' })).toEqual([
      'description-empty',
    ])
    expect(rulesOf({ name: 'a', description: ' \n\t ' })).toEqual([
      'description-empty',
    ])
  })

  it('must be text', () => {
    for (const description of [42, true, ['a'], { text: 'a' }]) {
      expect(rulesOf({ name: 'a', description })).toEqual([
        'description-not-text',
      ])
    }
  })

  it('allows up to 1024 characters', () => {
    expect(
      rulesOf({ name: 'a', description: 'x'.repeat(DESCRIPTION_MAX_LENGTH) }),
    ).toEqual([])
  })

  it('is too long past 1024 characters, and says how long', () => {
    const problems = checkSkillFrontmatter({
      name: 'a',
      description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1),
    })
    expect(problems).toEqual([
      {
        field: 'description',
        rule: 'description-too-long',
        message: 'description has 1025 characters; the limit is 1024',
      },
    ])
  })

  it('counts characters, not UTF-16 units', () => {
    expect(
      rulesOf({ name: 'a', description: '😀'.repeat(DESCRIPTION_MAX_LENGTH) }),
    ).toEqual([])
    expect(
      rulesOf({
        name: 'a',
        description: '😀'.repeat(DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).toEqual(['description-too-long'])
  })
})

describe('name', () => {
  const nameRules = (name: unknown, folderName?: string) =>
    rulesOf({ name, description: 'Does a thing.' }, folderName)

  it('is missing when absent, undefined or null', () => {
    expect(rulesOf({ description: 'Does a thing.' })).toEqual(['name-missing'])
    expect(nameRules(undefined)).toEqual(['name-missing'])
    expect(nameRules(null)).toEqual(['name-missing'])
  })

  it('is empty when blank, and gets no further problems', () => {
    expect(nameRules('')).toEqual(['name-empty'])
    expect(nameRules('  ', 'folder')).toEqual(['name-empty'])
  })

  it('must be text', () => {
    for (const name of [42, true, ['a'], { text: 'a' }]) {
      expect(nameRules(name, 'folder')).toEqual(['name-not-text'])
    }
  })

  it('allows lowercase letters, digits and single hyphens', () => {
    for (const name of ['a', 'pdf-processing', 'v2-tools', '2024', 'a-b-c']) {
      expect(nameRules(name)).toEqual([])
    }
  })

  it('allows lowercase letters outside a-z', () => {
    for (const name of ['análise-de-dados', 'ação', 'データ']) {
      expect(nameRules(name)).toEqual([])
    }
  })

  it('allows up to 64 characters', () => {
    expect(nameRules('a'.repeat(NAME_MAX_LENGTH))).toEqual([])
  })

  it('is too long past 64 characters, and says how long', () => {
    const problems = checkSkillFrontmatter({
      name: 'a'.repeat(NAME_MAX_LENGTH + 1),
      description: 'Does a thing.',
    })
    expect(problems).toEqual([
      {
        field: 'name',
        rule: 'name-too-long',
        message: 'name has 65 characters; the limit is 64',
      },
    ])
  })

  it('measures the length after Unicode compatibility normalization', () => {
    expect(nameRules('ａ'.repeat(NAME_MAX_LENGTH))).toEqual([])
    expect(nameRules('ａ'.repeat(NAME_MAX_LENGTH + 1))).toEqual([
      'name-too-long',
    ])
  })

  it('must be lowercase', () => {
    expect(nameRules('PDF-Processing')).toEqual(['name-not-lowercase'])
    expect(nameRules('Pdf')).toEqual(['name-not-lowercase'])
    expect(nameRules('ÁGUA')).toEqual(['name-not-lowercase'])
  })

  it('rejects characters other than letters, digits and hyphens', () => {
    for (const name of [
      'pdf processing',
      'pdf_processing',
      'pdf.processing',
      'pdf/processing',
      'pdf:processing',
      ' pdf',
      'pdf ',
      'pdf\n',
      'pdf🙂',
    ]) {
      expect(nameRules(name)).toEqual(['name-invalid-characters'])
    }
  })

  it('must not start or end with a hyphen', () => {
    expect(nameRules('-pdf')).toEqual(['name-edge-hyphen'])
    expect(nameRules('pdf-')).toEqual(['name-edge-hyphen'])
    expect(nameRules('-')).toEqual(['name-edge-hyphen'])
  })

  it('must not contain consecutive hyphens', () => {
    expect(nameRules('pdf--processing')).toEqual(['name-double-hyphen'])
    expect(nameRules('pdf---processing')).toEqual(['name-double-hyphen'])
  })

  it('reports every broken rule at once', () => {
    expect(nameRules('-Bad--Name_')).toEqual([
      'name-not-lowercase',
      'name-edge-hyphen',
      'name-double-hyphen',
      'name-invalid-characters',
    ])
  })
})

describe('name and folder', () => {
  const folderRules = (name: unknown, folderName?: string) =>
    rulesOf({ name, description: 'Does a thing.' }, folderName)

  it('is not checked without a folder name', () => {
    expect(folderRules('anything')).toEqual([])
  })

  it('passes when it matches the folder name', () => {
    expect(folderRules('pdf-processing', 'pdf-processing')).toEqual([])
  })

  it('reports a mismatch, naming the folder', () => {
    expect(
      checkSkillFrontmatter(
        { name: 'pdf-processing', description: 'Does a thing.' },
        'pdf-tools',
      ),
    ).toEqual([
      {
        field: 'name',
        rule: 'name-folder-mismatch',
        message: 'name must match its folder name, "pdf-tools"',
      },
    ])
  })

  it('compares case-sensitively', () => {
    expect(folderRules('pdf', 'PDF')).toEqual(['name-folder-mismatch'])
  })

  it('compares after Unicode compatibility normalization', () => {
    expect(folderRules('café', 'café')).toEqual([])
    expect(folderRules('ação', 'ação')).toEqual([])
  })

  it('also reports a mismatch for an otherwise invalid name', () => {
    expect(folderRules('Pdf', 'pdf')).toEqual([
      'name-not-lowercase',
      'name-folder-mismatch',
    ])
  })

  it('has nothing to compare when the name is missing or empty', () => {
    expect(folderRules(undefined, 'pdf')).toEqual(['name-missing'])
    expect(folderRules('', 'pdf')).toEqual(['name-empty'])
  })

  it('treats an empty folder name as a name to match', () => {
    expect(folderRules('pdf', '')).toEqual(['name-folder-mismatch'])
  })
})
