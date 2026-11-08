import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stageSkill } from './stage'

const made: string[] = []

const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'chiri-stage-test-'))
  made.push(dir)
  return dir
}

const put = (root: string, path: string, text = 'x'): void => {
  const file = join(root, path)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, text)
}

const skillIn = (): { base: string; skill: string } => {
  const base = scratch()
  const skill = join(base, 'my-skill')
  put(skill, 'SKILL.md', '---\nname: my-skill\n---\nBody\n')
  put(skill, 'evals/one/prompt.md')
  put(skill, 'evals/one/graders/a.md')
  put(skill, 'evals/two/prompt.md')
  put(skill, 'notes.md', 'notes')
  return { base, skill }
}

afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('stageSkill with another SKILL.md', () => {
  it("replaces SKILL.md in the copy, keeps today's other files and the real folder", async () => {
    const { skill } = skillIn()
    const stage = await stageSkill(skill, scratch(), 'Older text\n')
    expect(readFileSync(join(stage.dir, 'SKILL.md'), 'utf8')).toBe(
      'Older text\n',
    )
    expect(stage.skillText).toBe('Older text\n')
    expect(readFileSync(join(stage.dir, 'notes.md'), 'utf8')).toBe('notes')
    expect(stage.caseCount).toBe(2)
    expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toContain('Body')
  })

  it('does not write through a SKILL.md that links to a file outside', async () => {
    const { base, skill } = skillIn()
    const outside = join(base, 'outside.md')
    writeFileSync(outside, 'outside')
    rmSync(join(skill, 'SKILL.md'))
    symlinkSync(outside, join(skill, 'SKILL.md'))
    const stage = await stageSkill(skill, scratch(), 'Older\n')
    expect(readFileSync(outside, 'utf8')).toBe('outside')
    expect(readFileSync(join(stage.dir, 'SKILL.md'), 'utf8')).toBe('Older\n')
  })
})

describe('stageSkill', () => {
  it('copies the skill and counts the cases', async () => {
    const { skill } = skillIn()
    const stage = await stageSkill(skill, scratch())
    expect(readFileSync(join(stage.dir, 'notes.md'), 'utf8')).toBe('notes')
    expect(stage.skillText).toContain('Body')
    expect(stage.caseCount).toBe(2)
    expect(stage.leftOut).toEqual([])
    expect(stage.dir.endsWith('my-skill')).toBe(true)
    await stage.cleanup()
  })

  it('leaves out the folders and files that load code', async () => {
    const { skill } = skillIn()
    for (const path of [
      'hooks/hooks.json',
      '.claude-plugin/plugin.json',
      '.mcp.json',
      '.lsp.json',
      'settings.json',
      'agents/a.md',
      'commands/c.md',
    ])
      put(skill, path)
    const stage = await stageSkill(skill, scratch())
    for (const path of [
      'hooks',
      '.claude-plugin',
      '.mcp.json',
      '.lsp.json',
      'settings.json',
      'agents',
      'commands',
    ])
      expect(existsSync(join(stage.dir, path))).toBe(false)
    expect(stage.leftOut).toEqual([
      '.claude-plugin',
      '.lsp.json',
      '.mcp.json',
      'agents',
      'commands',
      'hooks',
      'settings.json',
    ])
    await stage.cleanup()
  })

  it('follows no link out of the folder', async () => {
    const { base, skill } = skillIn()
    put(base, 'outside/secret.txt', 'secret')
    symlinkSync(join(base, 'outside'), join(skill, 'out-dir'))
    symlinkSync(join(base, 'outside', 'secret.txt'), join(skill, 'out-file'))
    const stage = await stageSkill(skill, scratch())
    expect(existsSync(join(stage.dir, 'out-dir'))).toBe(false)
    expect(existsSync(join(stage.dir, 'out-file'))).toBe(false)
    expect(stage.leftOut).toEqual(['out-dir', 'out-file'])
    await stage.cleanup()
  })

  it('follows no link out at depth or through an internal link', async () => {
    const { base, skill } = skillIn()
    put(base, 'outside/secret.txt', 'secret')
    symlinkSync(join(base, 'outside'), join(skill, 'evals', 'one', 'out'))
    put(skill, 'shared/keep.md', 'keep')
    symlinkSync(join(base, 'outside'), join(skill, 'shared', 'escape'))
    symlinkSync(join(skill, 'shared'), join(skill, 'via'))
    const stage = await stageSkill(skill, scratch())
    expect(existsSync(join(stage.dir, 'evals', 'one', 'out'))).toBe(false)
    expect(readFileSync(join(stage.dir, 'via', 'keep.md'), 'utf8')).toBe('keep')
    expect(existsSync(join(stage.dir, 'via', 'escape'))).toBe(false)
    expect(stage.leftOut).toEqual([
      'evals/one/out',
      'shared/escape',
      'via/escape',
    ])
    await stage.cleanup()
  })

  it('copies a link that stays inside and survives a loop', async () => {
    const { skill } = skillIn()
    symlinkSync(join(skill, 'notes.md'), join(skill, 'alias.md'))
    symlinkSync(skill, join(skill, 'loop'))
    const stage = await stageSkill(skill, scratch())
    expect(readFileSync(join(stage.dir, 'alias.md'), 'utf8')).toBe('notes')
    expect(existsSync(join(stage.dir, 'loop'))).toBe(false)
    expect(stage.leftOut).toEqual(['loop'])
    await stage.cleanup()
  })

  it('is deleted by cleanup and never touches the real folder', async () => {
    const { skill } = skillIn()
    const stage = await stageSkill(skill, scratch())
    const container = join(stage.dir, '..')
    await stage.cleanup()
    expect(existsSync(container)).toBe(false)
    expect(existsSync(join(skill, 'SKILL.md'))).toBe(true)
  })

  it('cleans up when the copy fails', async () => {
    const base = scratch()
    const skill = join(base, 'broken')
    mkdirSync(skill)
    const temp = scratch()
    await expect(stageSkill(skill, temp)).rejects.toThrow()
    expect(readdirSync(temp)).toEqual([])
  })
})
