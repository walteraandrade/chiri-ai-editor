import { describe, expect, it } from 'vitest'
import { readFrontmatter } from './frontmatter-fields'
import {
  checkSkillFrontmatter,
  DESCRIPTION_MAX_LENGTH,
} from './skill-frontmatter'
import { skillTemplate, TEMPLATE_DESCRIPTION } from './skill-template'

const fieldsOf = (text: string): Readonly<Record<string, unknown>> => {
  const reading = readFrontmatter(text)
  if (reading.kind !== 'present') throw new Error(reading.kind)
  return reading.fields
}

describe('skillTemplate', () => {
  it('starts with the frontmatter the Agent Skills format asks for', () => {
    expect(
      skillTemplate('pdf-processing').startsWith(
        `---\nname: pdf-processing\ndescription: ${TEMPLATE_DESCRIPTION}\n---\n\n`,
      ),
    ).toBe(true)
  })

  it('reads back as the name given and the placeholder description', () => {
    expect(fieldsOf(skillTemplate('pdf-processing'))).toEqual({
      name: 'pdf-processing',
      description: TEMPLATE_DESCRIPTION,
    })
  })

  it('passes every check with the folder named after the skill', () => {
    for (const name of ['pdf-processing', 'a', 'ação', 'x-1', '9lives']) {
      expect(
        checkSkillFrontmatter(fieldsOf(skillTemplate(name)), name),
      ).toEqual([])
    }
  })

  it('keeps a name that YAML would read as another type a string', () => {
    for (const name of ['true', 'null', '123', '1e3', '0x1f', '007', '٣']) {
      expect(fieldsOf(skillTemplate(name)).name).toBe(name)
    }
  })

  it('writes the trimmed name', () => {
    expect(fieldsOf(skillTemplate('  pdf  ')).name).toBe('pdf')
  })

  it('has a placeholder description inside the limit', () => {
    expect(TEMPLATE_DESCRIPTION.trim()).not.toBe('')
    expect(TEMPLATE_DESCRIPTION.length).toBeLessThanOrEqual(
      DESCRIPTION_MAX_LENGTH,
    )
    expect(TEMPLATE_DESCRIPTION).not.toContain('\n')
  })

  it('titles the body with the name in words', () => {
    expect(skillTemplate('pdf-processing')).toContain('\n# Pdf processing\n')
    expect(skillTemplate('ação-rápida')).toContain('\n# Ação rápida\n')
    expect(skillTemplate('123')).toContain('\n# 123\n')
  })

  it('has the sections the specification recommends', () => {
    const text = skillTemplate('pdf-processing')
    expect(text).toContain('\n## Instructions\n')
    expect(text).toContain('\n## Examples\n')
    expect(text).toContain('\n## Edge cases\n')
  })

  it('ends with one line break, uses LF and stays far under 500 lines', () => {
    const text = skillTemplate('pdf-processing')
    expect(text.endsWith('\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
    expect(text).not.toContain('\r')
    expect(text.split('\n').length).toBeLessThan(60)
  })

  it('does not open with a second --- block that would confuse the body', () => {
    const text = skillTemplate('pdf-processing')
    expect(text.indexOf('\n---\n')).toBe(text.lastIndexOf('\n---\n'))
  })
})
