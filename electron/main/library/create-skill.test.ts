import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFrontmatter } from '../../../src/skills/frontmatter-fields'
import { checkSkillFrontmatter } from '../../../src/skills/skill-frontmatter'
import { skillTemplate } from '../../../src/skills/skill-template'
import {
  type CreateSkillDeps,
  createSkill,
  nodeCreateSkillFs,
} from './create-skill'
import type { RootsLoad } from './roots-store'

let dir = ''
let home = ''
let claudeRoot = ''
let projectRoot = ''

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'desafinado-create-')))
  home = join(dir, 'home')
  claudeRoot = join(home, '.claude', 'skills')
  projectRoot = join(dir, 'repo', '.claude', 'skills')
  await mkdir(claudeRoot, { recursive: true })
  await mkdir(projectRoot, { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const depsFor = (
  load: RootsLoad = { kind: 'loaded', roots: [projectRoot] },
  overrides: Partial<CreateSkillDeps> = {},
): CreateSkillDeps => ({
  home,
  store: {
    load: async () => load,
    save: async () => undefined,
  },
  fileSystem: nodeCreateSkillFs,
  ...overrides,
})

const namesIn = async (path: string): Promise<readonly string[]> =>
  (await readdir(path)).toSorted()

describe('createSkill', () => {
  it('creates <root>/<name>/SKILL.md from the template', async () => {
    const result = await createSkill(depsFor(), {
      root: claudeRoot,
      name: 'pdf-processing',
    })
    const path = join(claudeRoot, 'pdf-processing', 'SKILL.md')
    expect(result).toEqual({ kind: 'created', path, name: 'pdf-processing' })
    expect(await readFile(path, 'utf8')).toBe(skillTemplate('pdf-processing'))
  })

  it('writes a SKILL.md that Claude Code and the checks accept', async () => {
    await createSkill(depsFor(), { root: claudeRoot, name: 'pdf-processing' })
    const text = await readFile(
      join(claudeRoot, 'pdf-processing', 'SKILL.md'),
      'utf8',
    )
    const reading = readFrontmatter(text)
    expect(reading.kind).toBe('present')
    if (reading.kind !== 'present') return
    expect(checkSkillFrontmatter(reading.fields, 'pdf-processing')).toEqual([])
    expect(await namesIn(join(claudeRoot, 'pdf-processing'))).toEqual([
      'SKILL.md',
    ])
  })

  it('creates a skill in a project root the Library lists', async () => {
    const result = await createSkill(depsFor(), {
      root: projectRoot,
      name: 'local-skill',
    })
    expect(result.kind).toBe('created')
    expect(await namesIn(projectRoot)).toEqual(['local-skill'])
  })

  it('creates in the second default root', async () => {
    const agentsRoot = join(home, '.agents', 'skills')
    await mkdir(agentsRoot, { recursive: true })
    const result = await createSkill(depsFor(), {
      root: agentsRoot,
      name: 'shared',
    })
    expect(result.kind).toBe('created')
  })

  it('uses the trimmed name for the folder and the frontmatter', async () => {
    const result = await createSkill(depsFor(), {
      root: claudeRoot,
      name: '  trimmed  ',
    })
    expect(result).toMatchObject({ kind: 'created', name: 'trimmed' })
    expect(await namesIn(claudeRoot)).toEqual(['trimmed'])
  })

  it('accepts a name with accents', async () => {
    const result = await createSkill(depsFor(), {
      root: claudeRoot,
      name: 'ação-rápida',
    })
    expect(result.kind).toBe('created')
    expect(await namesIn(claudeRoot)).toEqual(['ação-rápida'])
  })

  it('answers with the real path when the root is reached through a link', async () => {
    const link = join(dir, 'link-to-skills')
    await symlink(projectRoot, link)
    const result = await createSkill(
      depsFor({ kind: 'loaded', roots: [link] }),
      {
        root: link,
        name: 'via-link',
      },
    )
    expect(result).toEqual({
      kind: 'created',
      path: join(projectRoot, 'via-link', 'SKILL.md'),
      name: 'via-link',
    })
  })

  describe('refuses a name that breaks a rule, and creates nothing', () => {
    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['uppercase', 'Pdf'],
      ['a slash', 'a/b'],
      ['a parent folder', '..'],
      ['a path out of the root', '../escape'],
      ['a dot', '.'],
      ['a hidden name', '.hidden'],
      ['a backslash', 'a\\b'],
      ['a fullwidth slash', 'a／b'],
      ['double hyphens', 'a--b'],
      ['an edge hyphen', '-a'],
      ['a space', 'a b'],
      ['over 64 characters', 'a'.repeat(65)],
    ])('%s', async (_label, name) => {
      const before = await namesIn(dir)
      const result = await createSkill(depsFor(), { root: claudeRoot, name })
      expect(result.kind).toBe('failed')
      expect(await namesIn(claudeRoot)).toEqual([])
      expect(await namesIn(dir)).toEqual(before)
    })

    it('says which rule it broke', async () => {
      expect(
        await createSkill(depsFor(), { root: claudeRoot, name: 'Pdf' }),
      ).toEqual({ kind: 'failed', reason: 'name must be lowercase' })
    })
  })

  describe('refuses to touch what is already there', () => {
    it('a folder with the name', async () => {
      await mkdir(join(claudeRoot, 'taken'))
      await writeFile(join(claudeRoot, 'taken', 'SKILL.md'), 'mine\n')
      const result = await createSkill(depsFor(), {
        root: claudeRoot,
        name: 'taken',
      })
      expect(result).toEqual({
        kind: 'failed',
        reason: 'A folder named "taken" already exists there',
      })
      expect(
        await readFile(join(claudeRoot, 'taken', 'SKILL.md'), 'utf8'),
      ).toBe('mine\n')
    })

    it('an empty folder with the name', async () => {
      await mkdir(join(claudeRoot, 'empty'))
      const result = await createSkill(depsFor(), {
        root: claudeRoot,
        name: 'empty',
      })
      expect(result.kind).toBe('failed')
      expect(await namesIn(join(claudeRoot, 'empty'))).toEqual([])
    })

    it('a file with the name', async () => {
      await writeFile(join(claudeRoot, 'file'), 'x')
      const result = await createSkill(depsFor(), {
        root: claudeRoot,
        name: 'file',
      })
      expect(result.kind).toBe('failed')
      expect(await readFile(join(claudeRoot, 'file'), 'utf8')).toBe('x')
    })

    it('a link with the name, even a broken one', async () => {
      await symlink(join(dir, 'nowhere'), join(claudeRoot, 'dangling'))
      const result = await createSkill(depsFor(), {
        root: claudeRoot,
        name: 'dangling',
      })
      expect(result.kind).toBe('failed')
      await expect(stat(join(dir, 'nowhere'))).rejects.toThrow()
    })

    it('leaves other names free', async () => {
      await mkdir(join(claudeRoot, 'taken'))
      const result = await createSkill(depsFor(), {
        root: claudeRoot,
        name: 'free',
      })
      expect(result.kind).toBe('created')
    })

    it('creates once when two requests race for the same name', async () => {
      const results = await Promise.all([
        createSkill(depsFor(), { root: claudeRoot, name: 'race' }),
        createSkill(depsFor(), { root: claudeRoot, name: 'race' }),
        createSkill(depsFor(), { root: claudeRoot, name: 'race' }),
      ])
      expect(results.filter(({ kind }) => kind === 'created')).toHaveLength(1)
      expect(await namesIn(join(claudeRoot, 'race'))).toEqual(['SKILL.md'])
    })
  })

  describe('only creates inside a folder of the Library', () => {
    it('refuses a folder that is not a root', async () => {
      const elsewhere = join(dir, 'elsewhere')
      await mkdir(elsewhere)
      const result = await createSkill(depsFor(), {
        root: elsewhere,
        name: 'pdf',
      })
      expect(result).toEqual({ kind: 'failed', reason: 'Not a Library folder' })
      expect(await namesIn(elsewhere)).toEqual([])
    })

    it('refuses the parent of a root and a folder inside one', async () => {
      for (const root of [join(home, '.claude'), join(claudeRoot, 'pdf')]) {
        await mkdir(root, { recursive: true })
        const result = await createSkill(depsFor(), { root, name: 'x' })
        expect(result.kind).toBe('failed')
      }
      expect(await namesIn(claudeRoot)).toEqual(['pdf'])
    })

    it('refuses a root with a trailing slash or dots, which is no listed root', async () => {
      for (const root of [`${claudeRoot}/`, `${claudeRoot}/../skills`]) {
        const result = await createSkill(depsFor(), { root, name: 'x' })
        expect(result.kind).toBe('failed')
      }
      expect(await namesIn(claudeRoot)).toEqual([])
    })

    it('refuses a project root that was removed from the Library', async () => {
      const result = await createSkill(depsFor({ kind: 'loaded', roots: [] }), {
        root: projectRoot,
        name: 'pdf',
      })
      expect(result.kind).toBe('failed')
      expect(await namesIn(projectRoot)).toEqual([])
    })

    it('refuses when the list of roots cannot be read', async () => {
      const result = await createSkill(depsFor({ kind: 'unreadable' }), {
        root: claudeRoot,
        name: 'pdf',
      })
      expect(result).toEqual({
        kind: 'failed',
        reason: 'Could not read library-roots.json',
      })
      expect(await namesIn(claudeRoot)).toEqual([])
    })

    it('says so when a listed root is gone', async () => {
      await rm(projectRoot, { recursive: true })
      const result = await createSkill(depsFor(), {
        root: projectRoot,
        name: 'pdf',
      })
      expect(result).toEqual({ kind: 'failed', reason: 'Folder not found' })
      await expect(stat(projectRoot)).rejects.toThrow()
    })
  })

  describe('refuses an invalid request', () => {
    it.each([
      ['an extra field', { root: 'ROOT', name: 'pdf', extra: 1 }],
      ['a relative root', { root: 'skills', name: 'pdf' }],
      ['a name that is not text', { root: 'ROOT', name: 7 }],
      ['null', null],
      ['a string', 'ROOT'],
    ])('%s', async (_label, input) => {
      const request =
        input !== null && typeof input === 'object' && 'root' in input
          ? { ...input, root: input.root === 'ROOT' ? claudeRoot : input.root }
          : input
      expect(await createSkill(depsFor(), request)).toEqual({
        kind: 'failed',
        reason: 'Invalid request',
      })
      expect(await namesIn(claudeRoot)).toEqual([])
    })
  })

  describe('when the write fails', () => {
    it('removes the folder it made and says why', async () => {
      const failing = {
        ...nodeCreateSkillFs,
        writeFile: async () => {
          throw Object.assign(new Error('no space'), { code: 'ENOSPC' })
        },
      }
      const result = await createSkill(
        depsFor(undefined, { fileSystem: failing }),
        {
          root: claudeRoot,
          name: 'pdf',
        },
      )
      expect(result).toEqual({
        kind: 'failed',
        reason: 'No space left on the device',
      })
      expect(await namesIn(claudeRoot)).toEqual([])
    })

    it('leaves a folder it did not make alone', async () => {
      const failing = {
        ...nodeCreateSkillFs,
        makeDirectory: async () => {
          throw Object.assign(new Error('denied'), { code: 'EACCES' })
        },
        removeDirectory: async () => {
          throw new Error('must not be called')
        },
      }
      await mkdir(join(claudeRoot, 'pdf'))
      const result = await createSkill(
        depsFor(undefined, { fileSystem: failing }),
        {
          root: claudeRoot,
          name: 'pdf',
        },
      )
      expect(result).toEqual({ kind: 'failed', reason: 'Permission denied' })
      expect(await namesIn(claudeRoot)).toEqual(['pdf'])
    })

    it('still reports the failure when the cleanup fails too', async () => {
      const failing = {
        ...nodeCreateSkillFs,
        writeFile: async () => {
          throw Object.assign(new Error('read only'), { code: 'EROFS' })
        },
        removeDirectory: async () => {
          throw new Error('busy')
        },
      }
      const result = await createSkill(
        depsFor(undefined, { fileSystem: failing }),
        {
          root: claudeRoot,
          name: 'pdf',
        },
      )
      expect(result).toEqual({
        kind: 'failed',
        reason: 'Read-only file system',
      })
    })
  })
})
