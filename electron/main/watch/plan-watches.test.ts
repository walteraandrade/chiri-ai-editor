import { describe, expect, it } from 'vitest'
import {
  createFakeFileSystem,
  type FakeTree,
  link,
} from '../../../src/skills/fake-file-system'
import { scanSkillRoots } from '../../../src/skills/scan-skills'
import { diffWatches, watchDirectories } from './plan-watches'

const skillText = (name: string): string =>
  `---\nname: ${name}\ndescription: About ${name}.\n---\n`

const CLAUDE = '/home/u/.claude/skills'
const AGENTS = '/home/u/.agents/skills'

const plan = async (
  tree: FakeTree,
  roots: readonly string[],
  openFile: string | null = null,
) => {
  const fileSystem = createFakeFileSystem(tree)
  const scans = await scanSkillRoots(fileSystem, roots)
  const readable = await Promise.all(
    scans
      .filter((scan) => scan.readable)
      .map((scan) => fileSystem.realPath(scan.root)),
  )
  return watchDirectories({
    roots: readable,
    skills: scans.flatMap((scan) => scan.skills),
    openFile,
  })
}

describe('watchDirectories', () => {
  it('watches the root, each skill folder and the folders inside it', async () => {
    expect(
      await plan(
        {
          [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf'),
          [`${CLAUDE}/pdf/references/guide.md`]: '# Guide\n',
          [`${CLAUDE}/pdf/references/deep/more.md`]: '# More\n',
        },
        [CLAUDE],
      ),
    ).toEqual([
      CLAUDE,
      `${CLAUDE}/pdf`,
      `${CLAUDE}/pdf/references`,
      `${CLAUDE}/pdf/references/deep`,
    ])
  })

  it('follows a skill reached through a link to where it really lives, and to the folder holding it', async () => {
    expect(
      await plan(
        {
          [`${CLAUDE}/shared`]: link('/work/repo/skills/shared'),
          '/work/repo/skills/shared/SKILL.md': skillText('shared'),
        },
        [CLAUDE],
      ),
    ).toEqual([CLAUDE, '/work/repo/skills', '/work/repo/skills/shared'])
  })

  it('watches the folder of a file reached through a link outside the skill', async () => {
    expect(
      await plan(
        {
          [`${CLAUDE}/gamma/SKILL.md`]: link('/elsewhere/notes/GAMMA.md'),
          '/elsewhere/notes/GAMMA.md': skillText('gamma'),
        },
        [CLAUDE],
      ),
    ).toEqual(['/elsewhere/notes', CLAUDE, `${CLAUDE}/gamma`])
  })

  it('lists a folder once when roots and skills share it', async () => {
    const dirs = await plan(
      {
        [`${CLAUDE}/a/SKILL.md`]: skillText('a'),
        [`${AGENTS}/b/SKILL.md`]: skillText('b'),
        [`${CLAUDE}/b`]: link(`${AGENTS}/b`),
      },
      [CLAUDE, AGENTS],
    )
    expect(dirs).toEqual(
      [CLAUDE, `${CLAUDE}/a`, AGENTS, `${AGENTS}/b`].toSorted(),
    )
    expect(new Set(dirs).size).toBe(dirs.length)
  })

  it('includes the folder of the open file, even outside every root', async () => {
    expect(
      await plan(
        { [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf') },
        [CLAUDE],
        '/notes/drafts/idea.md',
      ),
    ).toEqual([CLAUDE, `${CLAUDE}/pdf`, '/notes/drafts'])
  })

  it('adds the anchors it is given, once', () => {
    expect(
      watchDirectories({
        roots: [CLAUDE],
        skills: [],
        openFile: null,
        anchors: ['/work/repo/skills', CLAUDE],
      }),
    ).toEqual([CLAUDE, '/work/repo/skills'].toSorted())
  })

  it('skips a root that cannot be read', async () => {
    expect(await plan({ '/other/x.md': 'x' }, ['/missing/skills'])).toEqual([])
  })
})

describe('diffWatches', () => {
  const ids = (entries: Record<string, string>): ReadonlyMap<string, string> =>
    new Map(Object.entries(entries))

  it('opens what is new and closes what is gone', () => {
    expect(diffWatches(ids({ '/a': '1:1' }), ids({ '/b': '1:2' }))).toEqual({
      open: ['/b'],
      close: ['/a'],
    })
  })

  it('keeps a folder whose identity did not change', () => {
    expect(
      diffWatches(ids({ '/a': '1:1' }), ids({ '/a': '1:1', '/b': '1:2' })),
    ).toEqual({ open: ['/b'], close: [] })
  })

  it('reopens a folder that was deleted and made again, because the old watch went quiet', () => {
    expect(diffWatches(ids({ '/a': '1:1' }), ids({ '/a': '1:9' }))).toEqual({
      open: ['/a'],
      close: ['/a'],
    })
  })

  it('does nothing when nothing changed', () => {
    expect(diffWatches(ids({ '/a': '1:1' }), ids({ '/a': '1:1' }))).toEqual({
      open: [],
      close: [],
    })
  })
})
