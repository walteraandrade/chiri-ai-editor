import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanSkillRoots } from '../../../src/skills/scan-skills'
import { nodeSkillFileSystem } from './node-skill-fs'

let dir = ''

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'desafinado-skillfs-')))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const skillMd = (name: string, description: string): string =>
  `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`

describe('nodeSkillFileSystem', () => {
  it('lists entries by kind, links as links', async () => {
    await mkdir(join(dir, 'folder'))
    await writeFile(join(dir, 'file.md'), 'x')
    await symlink(join(dir, 'folder'), join(dir, 'link'))
    const entries = await nodeSkillFileSystem.listDirectory(dir)
    expect(entries.toSorted((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'file.md', kind: 'file' },
      { name: 'folder', kind: 'directory' },
      { name: 'link', kind: 'symlink' },
    ])
  })

  it('resolves a link to the real path', async () => {
    await mkdir(join(dir, 'folder'))
    await symlink(join(dir, 'folder'), join(dir, 'link'))
    expect(await nodeSkillFileSystem.realPath(join(dir, 'link'))).toBe(
      join(dir, 'folder'),
    )
  })

  it('reads text as UTF-8', async () => {
    await writeFile(join(dir, 'a.md'), 'olá\n')
    expect(await nodeSkillFileSystem.readText(join(dir, 'a.md'))).toBe('olá\n')
  })

  it('fails for a path that is not there', async () => {
    await expect(
      nodeSkillFileSystem.listDirectory(join(dir, 'missing')),
    ).rejects.toThrow()
  })
})

describe('scanning a real folder tree', () => {
  it('lists a skill once when a link and its target are both under roots', async () => {
    const agents = join(dir, 'agents')
    const claude = join(dir, 'claude')
    await mkdir(join(agents, 'pdf'), { recursive: true })
    await writeFile(
      join(agents, 'pdf', 'SKILL.md'),
      skillMd('pdf', 'Make PDFs'),
    )
    await writeFile(join(agents, 'pdf', 'notes.md'), '# notes\n')
    await mkdir(claude)
    await symlink(join(agents, 'pdf'), join(claude, 'pdf'))
    await mkdir(join(claude, 'local'))
    await writeFile(
      join(claude, 'local', 'SKILL.md'),
      skillMd('local', 'Local skill'),
    )
    await mkdir(join(claude, 'not-a-skill'))
    await writeFile(join(claude, 'not-a-skill', 'README.md'), '# no\n')

    const scans = await scanSkillRoots(nodeSkillFileSystem, [claude, agents])

    expect(scans.map(({ root, readable }) => [root, readable])).toEqual([
      [claude, true],
      [agents, true],
    ])
    expect(scans[0]?.skills.map((skill) => skill.name)).toEqual([
      'local',
      'pdf',
    ])
    expect(scans[1]?.skills).toEqual([])
    const pdf = scans[0]?.skills.find((skill) => skill.name === 'pdf')
    expect(pdf?.realPath).toBe(join(agents, 'pdf'))
    expect(pdf?.files.map((file) => file.name)).toEqual([
      'SKILL.md',
      'notes.md',
    ])
  })

  it('marks a root that is not there as unreadable', async () => {
    const scans = await scanSkillRoots(nodeSkillFileSystem, [
      join(dir, 'missing'),
    ])
    expect(scans).toEqual([
      { root: join(dir, 'missing'), readable: false, skills: [] },
    ])
  })
})
