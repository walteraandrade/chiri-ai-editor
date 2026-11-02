import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeFileSystem,
  type FakeTree,
  link,
} from '../../../src/skills/fake-file-system'
import type { LibrarySnapshot } from '../../../src/skills/library'
import { scanSkillRoots } from '../../../src/skills/scan-skills'
import type { ExternalChanges } from '../../api'
import { createExternalChanges } from './external-changes'
import type { DirectoryWatch, WatchListener } from './folder-watcher'

const CLAUDE = '/home/u/.claude/skills'
const DELAY_MS = 100

const skillText = (name: string): string =>
  `---\nname: ${name}\ndescription: About ${name}.\n---\n`

const setup = (initial: FakeTree, dangling: Record<string, string[]> = {}) => {
  let tree = initial
  const identities = new Map<string, string>()
  const opened = new Map<string, WatchListener>()
  const emitted: ExternalChanges[] = []
  const problems: string[] = []
  let lists = 0
  const list = vi.fn(async (): Promise<LibrarySnapshot> => {
    lists += 1
    const fileSystem = createFakeFileSystem(tree)
    const scans = await scanSkillRoots(fileSystem, [CLAUDE])
    return {
      roots: scans.map((scan) => ({
        ...scan,
        label: scan.root,
        removable: false,
      })),
      problem: null,
    }
  })
  const watch: DirectoryWatch = (dir, listener) => {
    opened.set(dir, listener)
    return { close: () => opened.delete(dir) }
  }
  const controller = createExternalChanges({
    list,
    realPath: async (path) => createFakeFileSystem(tree).realPath(path),
    identityOf: async (dir) => identities.get(dir) ?? null,
    watch,
    danglingTargets: async (root) => dangling[root] ?? [],
    emit: (changes) => emitted.push(changes),
    onProblem: (message) => problems.push(message),
    delayMs: DELAY_MS,
    maxWaitMs: 1000,
  })
  const exist = (...dirs: string[]) => {
    for (const dir of dirs) identities.set(dir, `1:${dir}`)
  }
  const recreate = (dir: string) => identities.set(dir, `2:${dir}`)
  const edit = (next: FakeTree) => {
    tree = next
  }
  const send = (dir: string, eventType: string, filename: string | null) =>
    opened.get(dir)?.event(eventType, filename)
  return {
    controller,
    opened,
    emitted,
    problems,
    list,
    exist,
    recreate,
    edit,
    send,
    lists: () => lists,
  }
}

const BASE: FakeTree = {
  [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf'),
  [`${CLAUDE}/pdf/references/guide.md`]: '# Guide\n',
}

describe('createExternalChanges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('watches the root, the skills and the folders inside them', async () => {
    const { controller, opened, exist } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    expect([...opened.keys()].toSorted()).toEqual([
      CLAUDE,
      `${CLAUDE}/pdf`,
      `${CLAUDE}/pdf/references`,
    ])
  })

  it('reports a change to a file after the burst is over, without scanning again', async () => {
    const { controller, emitted, exist, send, lists } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    send(`${CLAUDE}/pdf/references`, 'change', 'guide.md')
    send(`${CLAUDE}/pdf/references`, 'change', 'guide.md')
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(DELAY_MS)
    expect(emitted).toEqual([
      { paths: [`${CLAUDE}/pdf/references/guide.md`], library: false },
    ])
    await vi.advanceTimersByTimeAsync(0)
    expect(lists()).toBe(1)
  })

  it('follows a skill that is added: tells the Library and starts watching its folder', async () => {
    const { controller, emitted, exist, send, edit, opened, lists } =
      setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    edit({ ...BASE, [`${CLAUDE}/docx/SKILL.md`]: skillText('docx') })
    exist(`${CLAUDE}/docx`)
    send(CLAUDE, 'rename', 'docx')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted).toEqual([{ paths: [`${CLAUDE}/docx`], library: true }])
    expect(lists()).toBe(2)
    expect(opened.has(`${CLAUDE}/docx`)).toBe(true)
  })

  it('stops watching the folder of a skill that was removed', async () => {
    const { controller, exist, send, edit, opened } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    edit({})
    send(CLAUDE, 'rename', 'pdf')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(opened.has(`${CLAUDE}/pdf`)).toBe(false)
    expect(opened.has(`${CLAUDE}/pdf/references`)).toBe(false)
  })

  it('watches where a linked skill really lives, outside every root', async () => {
    const { controller, opened, exist } = setup({
      [`${CLAUDE}/shared`]: link('/work/repo/skills/shared'),
      '/work/repo/skills/shared/SKILL.md': skillText('shared'),
    })
    exist(CLAUDE, '/work/repo/skills', '/work/repo/skills/shared')
    await controller.start()
    expect(opened.has('/work/repo/skills/shared')).toBe(true)
  })

  it('keeps watching where a link whose target is gone would come back', async () => {
    const { controller, opened, exist } = setup(
      { [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf') },
      { [CLAUDE]: ['/work/repo/skills/removed'] },
    )
    exist(CLAUDE, `${CLAUDE}/pdf`, '/work/repo/skills')
    await controller.start()
    expect(opened.has('/work/repo/skills')).toBe(true)
  })

  it('falls back to the nearest folder that exists when the whole path of the target is gone', async () => {
    const { controller, opened, exist } = setup(
      { [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf') },
      { [CLAUDE]: ['/work/gone/deeper/removed'] },
    )
    exist(CLAUDE, `${CLAUDE}/pdf`, '/work')
    await controller.start()
    expect(opened.has('/work')).toBe(true)
  })

  it('sees a skill come back behind a link whose target was removed', async () => {
    const { controller, emitted, exist, send, edit, opened, lists } = setup(
      { [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf') },
      { [CLAUDE]: ['/work/repo/skills/shared'] },
    )
    exist(CLAUDE, `${CLAUDE}/pdf`, '/work/repo/skills')
    await controller.start()
    edit({
      [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf'),
      [`${CLAUDE}/shared`]: link('/work/repo/skills/shared'),
      '/work/repo/skills/shared/SKILL.md': skillText('shared'),
    })
    exist('/work/repo/skills/shared')
    send('/work/repo/skills', 'rename', 'shared')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted).toHaveLength(1)
    expect(lists()).toBe(2)
    expect(opened.has('/work/repo/skills/shared')).toBe(true)
  })

  it('watches where a root that does not exist yet would appear', async () => {
    const { controller, opened, exist } = setup({})
    exist('/home/u/.claude')
    await controller.start()
    expect(opened.has('/home/u/.claude')).toBe(true)
  })

  it('watches the folder of the open file, even outside every root', async () => {
    const { controller, opened, exist } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`, '/notes')
    await controller.start()
    await controller.watchFile('/notes/idea.md')
    expect(opened.has('/notes')).toBe(true)
    await controller.watchFile(null)
    expect(opened.has('/notes')).toBe(false)
  })

  it('reopens the watch of a folder that was deleted and made again', async () => {
    const { controller, opened, exist, recreate, send } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    const before = opened.get(`${CLAUDE}/pdf`)
    recreate(`${CLAUDE}/pdf`)
    send(CLAUDE, 'rename', 'pdf')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(opened.get(`${CLAUDE}/pdf`)).toBeDefined()
    expect(opened.get(`${CLAUDE}/pdf`)).not.toBe(before)
    expect(opened.get(CLAUDE)).toBeDefined()
  })

  it('does not report events from hidden temporary files', async () => {
    const { controller, emitted, exist, send } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    send(`${CLAUDE}/pdf`, 'rename', '.SKILL.md.3f2a.tmp')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted).toEqual([])
  })

  it('scans again when a root is added or removed', async () => {
    const { controller, lists } = setup(BASE)
    await controller.start()
    await controller.rootsChanged()
    expect(lists()).toBe(2)
  })

  it('says so, and goes on, when the Library cannot be read', async () => {
    const { controller, list, problems } = setup(BASE)
    list.mockRejectedValueOnce(new Error('EIO'))
    await controller.start()
    expect(problems).toHaveLength(1)
    await controller.rootsChanged()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('says so when a watch fails, without opening it again in a loop', async () => {
    const { controller, opened, exist, problems, list } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    opened.get(CLAUDE)?.failed(new Error('EPERM'))
    await vi.advanceTimersByTimeAsync(DELAY_MS * 5)
    expect(problems).toHaveLength(1)
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('goes quiet when closed', async () => {
    const { controller, opened, exist, send, emitted } = setup(BASE)
    exist(CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`)
    await controller.start()
    send(CLAUDE, 'rename', 'docx')
    controller.close()
    await vi.advanceTimersByTimeAsync(DELAY_MS * 5)
    expect(emitted).toEqual([])
    expect(opened.size).toBe(0)
  })
})
