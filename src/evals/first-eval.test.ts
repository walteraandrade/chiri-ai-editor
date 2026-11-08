import { describe, expect, it } from 'vitest'
import { firstEvalExample } from './first-eval'
import { matchesSkillName } from './report'

const fileText = (skillName: string, path: string): string =>
  firstEvalExample(skillName, skillName).files.find(
    (file) => file.path === path,
  )?.text ?? ''

const frontmatterValue = (text: string, key: string): string => {
  const line = text.split('\n').find((row) => row.startsWith(`${key}: `)) ?? ''
  return line
    .slice(key.length + 2)
    .replace(/^'(.*)'$/, '$1')
    .replaceAll("''", "'")
}

describe('firstEvalExample', () => {
  it("draws the folder under the Skill's own folder name", () => {
    const { tree } = firstEvalExample('pr-format', 'pr-format-skill')
    expect(tree.split('\n')[0]).toBe('pr-format-skill/evals/first-eval/')
    expect(tree).toContain('prompt.md')
    expect(tree).toContain('graders/')
    expect(tree).toContain('fired.md')
    expect(tree).toContain('answer.md')
  })

  it('lists a prompt, a fired grader and an answer grader', () => {
    expect(
      firstEvalExample('pr-format', 'pr-format').files.map(({ path }) => path),
    ).toEqual([
      'evals/first-eval/prompt.md',
      'evals/first-eval/graders/fired.md',
      'evals/first-eval/graders/answer.md',
    ])
  })

  it('checks that the Skill fired with a free tool_used grader', () => {
    const text = fileText('pr-format', 'evals/first-eval/graders/fired.md')
    expect(frontmatterValue(text, 'type')).toBe('tool_used')
    expect(frontmatterValue(text, 'tool')).toBe('Skill')
    expect(
      matchesSkillName(frontmatterValue(text, 'input_match'), 'pr-format'),
    ).toBe(true)
  })

  it('checks the answer with a free regex grader', () => {
    const text = fileText('pr-format', 'evals/first-eval/graders/answer.md')
    expect(frontmatterValue(text, 'type')).toBe('regex')
    const pattern = frontmatterValue(text, 'pattern')
    expect(new RegExp(pattern).test(pattern)).toBe(true)
  })

  it('escapes the Skill name so input_match matches only that Skill', () => {
    const text = fileText('a.b (x)', 'evals/first-eval/graders/fired.md')
    const pattern = frontmatterValue(text, 'input_match')
    expect(matchesSkillName(pattern, 'a.b (x)')).toBe(true)
    expect(matchesSkillName(pattern, 'axb (x)')).toBe(false)
  })

  it('does not fire for a Skill whose name only starts with this one', () => {
    const text = fileText('pr', 'evals/first-eval/graders/fired.md')
    const pattern = frontmatterValue(text, 'input_match')
    expect(matchesSkillName(pattern, 'pr')).toBe(true)
    expect(matchesSkillName(pattern, 'pr-format')).toBe(false)
    expect(matchesSkillName(pattern, 'api-pr')).toBe(false)
  })

  it('doubles single quotes inside a quoted value', () => {
    const text = fileText("it's", 'evals/first-eval/graders/fired.md')
    expect(text).toContain("input_match: '[\":]it''s\"'")
  })

  it('gives the prompt frontmatter the CLI scaffolds', () => {
    const text = fileText('pr-format', 'evals/first-eval/prompt.md')
    expect(text.startsWith('---\n')).toBe(true)
    expect(frontmatterValue(text, 'max_turns')).toBe('10')
  })
})
