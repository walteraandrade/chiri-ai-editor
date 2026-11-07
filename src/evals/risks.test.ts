import { describe, expect, it } from 'vitest'
import { findRisks, riskLines } from './risks'

const skill = (frontmatter: string, body = 'Do the thing.\n'): string =>
  `---\nname: s\ndescription: d\n${frontmatter}---\n${body}`

describe('findRisks', () => {
  it('finds nothing in a plain skill', () => {
    expect(findRisks({ skillText: skill(''), leftOut: [] })).toEqual([])
  })

  it('flags a hooks frontmatter field', () => {
    const risks = findRisks({
      skillText: skill('hooks:\n  PreToolUse: []\n'),
      leftOut: [],
    })
    expect(risks).toEqual([{ kind: 'hooks-frontmatter' }])
  })

  it('flags lines that run a shell command', () => {
    const risks = findRisks({
      skillText: skill('', 'Branch: !`git branch --show-current`\nplain\n'),
      leftOut: [],
    })
    expect(risks).toEqual([
      {
        kind: 'shell-commands',
        lines: ['Branch: !`git branch --show-current`'],
      },
    ])
  })

  it('flags fenced shell blocks', () => {
    const risks = findRisks({
      skillText: skill('', '```!\nls\n```\n'),
      leftOut: [],
    })
    expect(risks).toEqual([{ kind: 'shell-commands', lines: ['```!'] }])
  })

  it('names what the Stage left out', () => {
    expect(
      findRisks({ skillText: skill(''), leftOut: ['hooks/', 'link-out'] }),
    ).toEqual([{ kind: 'left-out', names: ['hooks/', 'link-out'] }])
  })

  it('still reads a skill whose frontmatter is broken', () => {
    expect(
      findRisks({ skillText: '---\n: [\n---\n!`ls`\n', leftOut: [] }),
    ).toEqual([{ kind: 'shell-commands', lines: ['!`ls`'] }])
  })

  it('is stable between calls', () => {
    const input = { skillText: skill('', '!`a`\n'), leftOut: ['x/'] }
    expect(findRisks(input)).toEqual(findRisks(input))
  })
})

describe('riskLines', () => {
  it('words each risk', () => {
    const lines = riskLines([
      { kind: 'hooks-frontmatter' },
      { kind: 'shell-commands', lines: ['!`ls`'] },
      { kind: 'left-out', names: ['hooks/'] },
    ])
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('hooks')
    expect(lines[1]).toContain('!`ls`')
    expect(lines[2]).toContain('hooks/')
  })
})
