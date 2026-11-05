import { describe, expect, it } from 'vitest'
import {
  createFakeFileSystem,
  deniedDirectory,
  deniedFile,
  emptyDirectory,
  type FakeTree,
  link,
  special,
} from './fake-file-system'
import {
  DEFAULT_MAX_DEPTH,
  type RootScan,
  type ScanOptions,
  scanSkillRoots,
} from './scan-skills'

const CLAUDE = '/home/u/.claude/skills'
const AGENTS = '/home/u/.agents/skills'
const REPO = '/home/u/code/repo/skills'

const skillText = (name: string, description = 'Does a thing.'): string =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

const scan = (
  tree: FakeTree,
  roots: readonly string[],
  options?: ScanOptions,
): Promise<readonly RootScan[]> =>
  scanSkillRoots(createFakeFileSystem(tree), roots, options)

const foldersOf = (rootScan: RootScan | undefined): readonly string[] =>
  rootScan?.skills.map((skill) => skill.folderName) ?? []

const only = async (tree: FakeTree, root = CLAUDE) => {
  const [rootScan] = await scan(tree, [root])
  const [skill] = rootScan?.skills ?? []
  if (skill === undefined) throw new Error('no skill found')
  return skill
}

describe('scanSkillRoots', () => {
  describe('a Skill', () => {
    it('is a folder under a root with a SKILL.md', async () => {
      const skill = await only({
        [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf-processing', 'Reads PDFs.'),
      })
      expect(skill).toMatchObject({
        realPath: `${CLAUDE}/pdf`,
        folderName: 'pdf',
        root: CLAUDE,
        name: 'pdf-processing',
        description: 'Reads PDFs.',
        problem: undefined,
      })
    })

    it('is shown by its frontmatter name, not its folder name', async () => {
      const skill = await only({
        [`${CLAUDE}/folder/SKILL.md`]: skillText('other-name'),
      })
      expect(skill.name).toBe('other-name')
      expect(skill.folderName).toBe('folder')
    })

    it('falls back to the folder name when the name is missing', async () => {
      const skill = await only({
        [`${CLAUDE}/folder/SKILL.md`]: '---\ndescription: Only this.\n---\n',
      })
      expect(skill).toMatchObject({
        name: 'folder',
        description: 'Only this.',
      })
    })

    it('falls back to the folder name when the name is empty or not text', async () => {
      const names = ['name: ""', 'name:', 'name: 12', 'name: [a]', 'name: "  "']
      const found = await Promise.all(
        names.map((line) =>
          only({ [`${CLAUDE}/folder/SKILL.md`]: `---\n${line}\n---\n` }),
        ),
      )
      expect(found.map((skill) => skill.name)).toEqual(
        names.map(() => 'folder'),
      )
    })

    it('trims the name and the description', async () => {
      const skill = await only({
        [`${CLAUDE}/folder/SKILL.md`]:
          '---\nname: "  spaced  "\ndescription: >\n  Folded\n  text\n---\n',
      })
      expect(skill).toMatchObject({
        name: 'spaced',
        description: 'Folded text',
      })
    })

    it('has no description when it is missing, empty or not text', async () => {
      const lines = ['', 'description:', 'description: ""', 'description: 3']
      const found = await Promise.all(
        lines.map((line) =>
          only({
            [`${CLAUDE}/folder/SKILL.md`]: `---\nname: folder\n${line}\n---\n`,
          }),
        ),
      )
      expect(found.map((skill) => skill.description)).toEqual(
        lines.map(() => undefined),
      )
    })

    it('uses the folder name when there is no frontmatter', async () => {
      const skill = await only({
        [`${CLAUDE}/folder/SKILL.md`]: '# Just text\n',
      })
      expect(skill).toMatchObject({
        name: 'folder',
        description: undefined,
        problem: undefined,
      })
    })

    it('keeps the folder name and reports the problem for a broken frontmatter', async () => {
      const broken = await only({
        [`${CLAUDE}/folder/SKILL.md`]:
          '---\nname: x\ndescription: Has: a colon\n---\n',
      })
      expect(broken).toMatchObject({
        name: 'folder',
        description: undefined,
        problem: { rule: 'yaml-syntax-error', line: 3 },
      })
      const unclosed = await only({
        [`${CLAUDE}/folder/SKILL.md`]: '---\nname: x\n\n# Body\n',
      })
      expect(unclosed.problem).toMatchObject({
        rule: 'frontmatter-not-closed',
      })
    })

    it('reads a SKILL.md with a BOM and CRLF line breaks', async () => {
      const skill = await only({
        [`${CLAUDE}/folder/SKILL.md`]:
          '﻿---\r\nname: crlf-skill\r\ndescription: Windows.\r\n---\r\n\r\n# Body\r\n',
      })
      expect(skill).toMatchObject({
        name: 'crlf-skill',
        description: 'Windows.',
        problem: undefined,
      })
    })
  })

  describe('folders that are not Skills', () => {
    it('skips a folder without a SKILL.md', async () => {
      const [rootScan] = await scan(
        {
          [`${CLAUDE}/notes/README.md`]: '# Notes',
          [`${CLAUDE}/real/SKILL.md`]: skillText('real'),
          [`${CLAUDE}/empty`]: emptyDirectory,
        },
        [CLAUDE],
      )
      expect(foldersOf(rootScan)).toEqual(['real'])
    })

    it('skips a folder whose SKILL.md is another name or a directory', async () => {
      const [rootScan] = await scan(
        {
          [`${CLAUDE}/lower/skill.md`]: skillText('lower'),
          [`${CLAUDE}/nested/inner/SKILL.md`]: skillText('nested'),
          [`${CLAUDE}/dir/SKILL.md/file.md`]: 'x',
        },
        [CLAUDE],
      )
      expect(foldersOf(rootScan)).toEqual([])
    })

    it('skips files and special entries in the root', async () => {
      const [rootScan] = await scan(
        {
          [`${CLAUDE}/SKILL.md`]: skillText('root'),
          [`${CLAUDE}/x.txt`]: 'x',
          [`${CLAUDE}/pipe`]: special,
        },
        [CLAUDE],
      )
      expect(foldersOf(rootScan)).toEqual([])
    })
  })

  describe('symlinks', () => {
    const tree: FakeTree = {
      [`${AGENTS}/shared/SKILL.md`]: skillText('shared'),
      [`${AGENTS}/shared/references/a.md`]: 'a',
      [`${AGENTS}/own/SKILL.md`]: skillText('own'),
      [`${CLAUDE}/shared`]: link(`${AGENTS}/shared`),
      [`${CLAUDE}/own`]: link('../../.agents/skills/own'),
      [`${CLAUDE}/mine/SKILL.md`]: skillText('mine'),
      [`${CLAUDE}/from-repo`]: link(`${REPO}/from-repo`),
      [`${REPO}/from-repo/SKILL.md`]: skillText('from-repo'),
      [`${REPO}/from-repo/scripts/run.sh`]: '#!/bin/sh',
    }

    it('shows a skill reached through a link and through its target once', async () => {
      const [claude, agents] = await scan(tree, [CLAUDE, AGENTS])
      expect(foldersOf(claude)).toEqual(['from-repo', 'mine', 'own', 'shared'])
      expect(foldersOf(agents)).toEqual([])
    })

    it('identifies a linked skill by its real path', async () => {
      const [claude] = await scan(tree, [CLAUDE, AGENTS])
      const shared = claude?.skills.find(
        (skill) => skill.folderName === 'shared',
      )
      expect(shared).toMatchObject({
        realPath: `${AGENTS}/shared`,
        root: CLAUDE,
        folderName: 'shared',
      })
      expect(shared?.files.map((file) => file.path)).toEqual([
        `${AGENTS}/shared/SKILL.md`,
        `${AGENTS}/shared/references/a.md`,
      ])
    })

    it('gives the skill to the first root that reaches it', async () => {
      const [agents, claude] = await scan(tree, [AGENTS, CLAUDE])
      expect(foldersOf(agents)).toEqual(['own', 'shared'])
      expect(foldersOf(claude)).toEqual(['from-repo', 'mine'])
    })

    it('shows a skill whose link points outside every root', async () => {
      const [claude] = await scan(tree, [CLAUDE, AGENTS])
      const fromRepo = claude?.skills.find(
        (skill) => skill.folderName === 'from-repo',
      )
      expect(fromRepo).toMatchObject({
        realPath: `${REPO}/from-repo`,
        root: CLAUDE,
        name: 'from-repo',
      })
      expect(fromRepo?.files.map((file) => file.name)).toEqual([
        'SKILL.md',
        'scripts/run.sh',
      ])
    })

    it('shows a skill once when the same root is given twice', async () => {
      const result = await scan(tree, [CLAUDE, CLAUDE])
      expect(foldersOf(result[0])).toEqual([
        'from-repo',
        'mine',
        'own',
        'shared',
      ])
      expect(foldersOf(result[1])).toEqual([])
    })

    it('shows a skill once when a root is a link to another root', async () => {
      const result = await scan(
        {
          ...tree,
          '/home/u/alias-root': link(AGENTS),
        },
        [AGENTS, '/home/u/alias-root'],
      )
      expect(foldersOf(result[0])).toEqual(['own', 'shared'])
      expect(foldersOf(result[1])).toEqual([])
    })

    it('shows a skill once when two links in a root point to it', async () => {
      const [claude] = await scan(
        {
          [`${AGENTS}/one/SKILL.md`]: skillText('one'),
          [`${CLAUDE}/b-link`]: link(`${AGENTS}/one`),
          [`${CLAUDE}/a-link`]: link(`${AGENTS}/one`),
        },
        [CLAUDE],
      )
      expect(foldersOf(claude)).toEqual(['a-link'])
    })

    it('reads a SKILL.md that is itself a link', async () => {
      const skill = await only({
        [`${CLAUDE}/linked-file/SKILL.md`]: link(`${REPO}/text/SKILL.md`),
        [`${REPO}/text/SKILL.md`]: skillText('from-elsewhere'),
      })
      expect(skill.name).toBe('from-elsewhere')
      expect(skill.files).toEqual([
        {
          path: `${REPO}/text/SKILL.md`,
          name: 'SKILL.md',
          isMarkdown: true,
        },
      ])
    })

    it('skips a broken link and keeps scanning', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/gone`]: link('/home/u/nowhere'),
          [`${CLAUDE}/loop-a`]: link(`${CLAUDE}/loop-b`),
          [`${CLAUDE}/loop-b`]: link(`${CLAUDE}/loop-a`),
          [`${CLAUDE}/fine/SKILL.md`]: skillText('fine'),
        },
        [CLAUDE],
      )
      expect(foldersOf(claude)).toEqual(['fine'])
    })

    it('skips a link to a file', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/to-file`]: link(`${REPO}/notes.md`),
          [`${REPO}/notes.md`]: '# Notes',
        },
        [CLAUDE],
      )
      expect(foldersOf(claude)).toEqual([])
    })
  })

  describe('files', () => {
    const files = async (tree: FakeTree, options?: ScanOptions) => {
      const [rootScan] = await scan(tree, [CLAUDE], options)
      return rootScan?.skills[0]?.files ?? []
    }
    const base = {
      [`${CLAUDE}/s/SKILL.md`]: skillText('s'),
    }

    it('lists the folder files with real paths and relative names', async () => {
      expect(
        await files({
          ...base,
          [`${CLAUDE}/s/notes.md`]: 'n',
          [`${CLAUDE}/s/data.json`]: '{}',
        }),
      ).toEqual([
        { path: `${CLAUDE}/s/SKILL.md`, name: 'SKILL.md', isMarkdown: true },
        { path: `${CLAUDE}/s/data.json`, name: 'data.json', isMarkdown: false },
        { path: `${CLAUDE}/s/notes.md`, name: 'notes.md', isMarkdown: true },
      ])
    })

    it('lists files in nested folders, with the folder in the name', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/references/api.md`]: 'api',
        [`${CLAUDE}/s/references/deep/more.md`]: 'more',
        [`${CLAUDE}/s/scripts/run.py`]: 'print()',
      })
      expect(found.map((file) => file.name)).toEqual([
        'SKILL.md',
        'references/api.md',
        'references/deep/more.md',
        'scripts/run.py',
      ])
      expect(found.map((file) => file.isMarkdown)).toEqual([
        true,
        true,
        true,
        false,
      ])
    })

    it('puts SKILL.md first and orders the rest by name', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/Zeta.md`]: 'z',
        [`${CLAUDE}/s/alpha.md`]: 'a',
        [`${CLAUDE}/s/Beta.md`]: 'b',
        [`${CLAUDE}/s/aardvark.txt`]: 'x',
      })
      expect(found.map((file) => file.name)).toEqual([
        'SKILL.md',
        'aardvark.txt',
        'alpha.md',
        'Beta.md',
        'Zeta.md',
      ])
    })

    it('marks Markdown by extension, ignoring case', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/UPPER.MD`]: 'x',
        [`${CLAUDE}/s/readme.markdown`]: 'x',
        [`${CLAUDE}/s/md`]: 'x',
        [`${CLAUDE}/s/notes.md.bak`]: 'x',
      })
      const marked = Object.fromEntries(
        found.map((file) => [file.name, file.isMarkdown]),
      )
      expect(marked).toEqual({
        'SKILL.md': true,
        'UPPER.MD': true,
        'readme.markdown': false,
        md: false,
        'notes.md.bak': false,
      })
    })

    it('skips hidden entries and node_modules', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/.DS_Store`]: 'x',
        [`${CLAUDE}/s/.git/config`]: 'x',
        [`${CLAUDE}/s/node_modules/pkg/index.js`]: 'x',
        [`${CLAUDE}/s/scripts/.cache/x.md`]: 'x',
        [`${CLAUDE}/s/scripts/run.sh`]: 'x',
      })
      expect(found.map((file) => file.name)).toEqual([
        'SKILL.md',
        'scripts/run.sh',
      ])
    })

    it('stops at the maximum depth', async () => {
      const tree = {
        ...base,
        [`${CLAUDE}/s/a.md`]: 'x',
        [`${CLAUDE}/s/one/b.md`]: 'x',
        [`${CLAUDE}/s/one/two/c.md`]: 'x',
        [`${CLAUDE}/s/one/two/three/d.md`]: 'x',
        [`${CLAUDE}/s/one/two/three/four/e.md`]: 'x',
      }
      expect(DEFAULT_MAX_DEPTH).toBe(3)
      expect((await files(tree)).map((file) => file.name)).toEqual([
        'SKILL.md',
        'a.md',
        'one/b.md',
        'one/two/c.md',
        'one/two/three/d.md',
      ])
      expect((await files(tree, { maxDepth: 0 })).map((f) => f.name)).toEqual([
        'SKILL.md',
        'a.md',
      ])
      expect((await files(tree, { maxDepth: 1 })).map((f) => f.name)).toEqual([
        'SKILL.md',
        'a.md',
        'one/b.md',
      ])
    })

    it('lists a file reached through a link by its real path', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/shared.md`]: link(`${REPO}/common/shared.md`),
        [`${REPO}/common/shared.md`]: 'x',
      })
      expect(found).toContainEqual({
        path: `${REPO}/common/shared.md`,
        name: 'shared.md',
        isMarkdown: true,
      })
    })

    it('follows a linked folder inside the skill', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/references`]: link(`${REPO}/refs`),
        [`${REPO}/refs/a.md`]: 'a',
      })
      expect(found).toContainEqual({
        path: `${REPO}/refs/a.md`,
        name: 'references/a.md',
        isMarkdown: true,
      })
    })

    it('does not loop on a link that points back up', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/again`]: link(`${CLAUDE}/s`),
        [`${CLAUDE}/s/refs/up`]: link(`${CLAUDE}/s`),
        [`${CLAUDE}/s/refs/a.md`]: 'a',
      })
      expect(found.map((file) => file.name)).toEqual(['SKILL.md', 'refs/a.md'])
    })

    it('lists a file once when two links reach it', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/one.md`]: link(`${REPO}/x.md`),
        [`${CLAUDE}/s/two.md`]: link(`${REPO}/x.md`),
        [`${REPO}/x.md`]: 'x',
      })
      expect(found.filter((file) => file.path === `${REPO}/x.md`)).toHaveLength(
        1,
      )
    })

    it('skips a broken link, an unreadable folder and a loop inside the skill', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/gone.md`]: link('/home/u/nowhere'),
        [`${CLAUDE}/s/vault`]: deniedDirectory,
        [`${CLAUDE}/s/loop-a`]: link(`${CLAUDE}/s/loop-b`),
        [`${CLAUDE}/s/loop-b`]: link(`${CLAUDE}/s/loop-a`),
        [`${CLAUDE}/s/kept.md`]: 'k',
      })
      expect(found.map((file) => file.name)).toEqual(['SKILL.md', 'kept.md'])
    })

    it('skips sockets and other special entries', async () => {
      const found = await files({ ...base, [`${CLAUDE}/s/pipe`]: special })
      expect(found.map((file) => file.name)).toEqual(['SKILL.md'])
    })

    it('does not list folders below the maximum depth', async () => {
      const fileSystem = createFakeFileSystem({
        ...base,
        [`${CLAUDE}/s/one/two/three/four/e.md`]: 'x',
      })
      const listed: string[] = []
      await scanSkillRoots(
        {
          ...fileSystem,
          listDirectory: (path) => {
            listed.push(path)
            return fileSystem.listDirectory(path)
          },
        },
        [CLAUDE],
      )
      expect(listed.some((path) => path.endsWith('/four'))).toBe(false)
    })

    it('lists a file it cannot read, since it only lists', async () => {
      const found = await files({
        ...base,
        [`${CLAUDE}/s/secret.md`]: deniedFile,
      })
      expect(found.map((file) => file.name)).toEqual(['SKILL.md', 'secret.md'])
    })
  })

  describe('unreadable things', () => {
    it('skips a Skill whose SKILL.md cannot be read', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/locked/SKILL.md`]: deniedFile,
          [`${CLAUDE}/fine/SKILL.md`]: skillText('fine'),
        },
        [CLAUDE],
      )
      expect(foldersOf(claude)).toEqual(['fine'])
    })

    it('skips a skill folder it cannot list', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/locked`]: deniedDirectory,
          [`${CLAUDE}/fine/SKILL.md`]: skillText('fine'),
        },
        [CLAUDE],
      )
      expect(foldersOf(claude)).toEqual(['fine'])
    })

    it('skips a Skill whose SKILL.md link is broken', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/dangling/SKILL.md`]: link('/home/u/nowhere'),
          [`${CLAUDE}/fine/SKILL.md`]: skillText('fine'),
        },
        [CLAUDE],
      )
      expect(foldersOf(claude)).toEqual(['fine'])
    })

    it('reports a root that is missing, a file or unreadable', async () => {
      const result = await scan(
        {
          '/home/u/file': 'x',
          '/home/u/locked': deniedDirectory,
          [`${CLAUDE}/fine/SKILL.md`]: skillText('fine'),
        },
        ['/home/u/missing', '/home/u/file', '/home/u/locked', CLAUDE],
      )
      expect(result.map(({ root, readable }) => [root, readable])).toEqual([
        ['/home/u/missing', false],
        ['/home/u/file', false],
        ['/home/u/locked', false],
        [CLAUDE, true],
      ])
      expect(result.slice(0, 3).flatMap((r) => r.skills)).toEqual([])
      expect(foldersOf(result[3])).toEqual(['fine'])
    })

    it('reports an empty root as readable with no skills', async () => {
      expect(await scan({ [CLAUDE]: emptyDirectory }, [CLAUDE])).toEqual([
        { root: CLAUDE, readable: true, skills: [] },
      ])
    })

    it('does not fail when the file system throws something that is not an Error', async () => {
      const result = await scanSkillRoots(
        {
          listDirectory: () => Promise.reject('plain string'),
          realPath: () => Promise.reject(undefined),
          readText: () => Promise.reject(null),
        },
        [CLAUDE],
      )
      expect(result).toEqual([{ root: CLAUDE, readable: false, skills: [] }])
    })
  })

  describe('order', () => {
    it('keeps the order of the roots', async () => {
      const result = await scan({}, ['/z', '/a', '/m'])
      expect(result.map(({ root }) => root)).toEqual(['/z', '/a', '/m'])
    })

    it('sorts Skills by name, ignoring case, then by folder name', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/z-folder/SKILL.md`]: skillText('alpha'),
          [`${CLAUDE}/a-folder/SKILL.md`]: skillText('Beta'),
          [`${CLAUDE}/c-folder/SKILL.md`]: skillText('alpha'),
          [`${CLAUDE}/d-folder/SKILL.md`]: skillText('Zulu'),
          [`${CLAUDE}/no-name/SKILL.md`]: '# no frontmatter',
        },
        [CLAUDE],
      )
      expect(claude?.skills.map((skill) => skill.folderName)).toEqual([
        'c-folder',
        'z-folder',
        'a-folder',
        'no-name',
        'd-folder',
      ])
    })

    it('sorts by code point, not by locale', async () => {
      const [claude] = await scan(
        {
          [`${CLAUDE}/e/SKILL.md`]: skillText('e'),
          [`${CLAUDE}/z/SKILL.md`]: skillText('z'),
          [`${CLAUDE}/é/SKILL.md`]: skillText('é'),
        },
        [CLAUDE],
      )
      expect(claude?.skills.map((skill) => skill.name)).toEqual(['e', 'z', 'é'])
    })

    it('gives the same result whatever order the file system lists in', async () => {
      const tree = {
        [`${CLAUDE}/b/SKILL.md`]: skillText('b'),
        [`${CLAUDE}/a/SKILL.md`]: skillText('a'),
        [`${CLAUDE}/a/two.md`]: 'x',
        [`${CLAUDE}/a/one.md`]: 'x',
      }
      const forward = createFakeFileSystem(tree)
      const reversed = {
        ...forward,
        listDirectory: async (path: string) =>
          [...(await forward.listDirectory(path))].reverse(),
      }
      expect(await scanSkillRoots(reversed, [CLAUDE])).toEqual(
        await scanSkillRoots(forward, [CLAUDE]),
      )
    })
  })

  it('scans nothing for no roots', async () => {
    expect(await scan({}, [])).toEqual([])
  })

  it('accepts a root written with a trailing slash', async () => {
    const [claude] = await scan({ [`${CLAUDE}/s/SKILL.md`]: skillText('s') }, [
      `${CLAUDE}/`,
    ])
    expect(claude?.root).toBe(`${CLAUDE}/`)
    expect(claude?.skills[0]).toMatchObject({
      root: `${CLAUDE}/`,
      realPath: `${CLAUDE}/s`,
    })
  })

  it('reads the machine layout: many skills, links into another root and a repo', async () => {
    const tree: Record<string, string | { link: string }> = {}
    const names = Array.from({ length: 12 }, (_, i) => `skill-${i}`)
    names.forEach((name, i) => {
      tree[`${AGENTS}/${name}/SKILL.md`] = skillText(name)
      tree[`${AGENTS}/${name}/references/ref.md`] = 'r'
      tree[i % 2 === 0 ? `${CLAUDE}/${name}` : `${CLAUDE}/own-${i}/SKILL.md`] =
        i % 2 === 0 ? link(`${AGENTS}/${name}`) : skillText(`own-${i}`)
    })
    const result = await scan(tree, [CLAUDE, AGENTS])
    const all = result.flatMap((r) => r.skills)
    expect(all.map((s) => s.realPath).sort()).toEqual(
      [...new Set(all.map((s) => s.realPath))].sort(),
    )
    expect(all).toHaveLength(12 + 6)
  })
})
