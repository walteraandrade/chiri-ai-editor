import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeFileSystem,
  emptyDirectory,
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
  const realPaths: Record<string, Promise<string> | undefined> = {}
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
  const rootEntries = async (root: string) => {
    const fileSystem = createFakeFileSystem(tree)
    const entries = await fileSystem.listDirectory(root).catch(() => [])
    const folders = await Promise.all(
      entries
        .filter(({ kind }) => kind === 'directory' || kind === 'symlink')
        .map(async ({ name }): Promise<readonly string[]> => {
          const real = await fileSystem
            .realPath(`${root}/${name}`)
            .catch(() => undefined)
          if (real === undefined) return []
          const isFolder = await fileSystem.listDirectory(real).then(
            () => true,
            () => false,
          )
          return isFolder ? [real] : []
        }),
    )
    return { folders: folders.flat(), dangling: dangling[root] ?? [] }
  }
  const controller = createExternalChanges({
    list,
    realPath: (path) =>
      realPaths[path] ?? createFakeFileSystem(tree).realPath(path),
    identityOf: async (dir) => identities.get(dir) ?? null,
    watch,
    rootEntries,
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
  const slowRealPath = (path: string) => {
    let settle: (real: string) => void = () => undefined
    realPaths[path] = new Promise<string>((resolve) => {
      settle = resolve
    })
    return settle
  }
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
    slowRealPath,
    lists: () => lists,
  }
}

const BASE: FakeTree = {
  [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf'),
  [`${CLAUDE}/pdf/references/guide.md`]: '# Guide\n',
}

const PDF_FOLDERS = [CLAUDE, `${CLAUDE}/pdf`, `${CLAUDE}/pdf/references`]

describe('createExternalChanges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('watches the root, the skills and the folders inside them', async () => {
    const { controller, opened, exist } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    expect([...opened.keys()].toSorted()).toEqual(PDF_FOLDERS)
  })

  it('reports a change to a file after the burst is over, without scanning again', async () => {
    const { controller, emitted, exist, send, lists } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    const scansAtStart = lists()
    send(`${CLAUDE}/pdf/references`, 'change', 'guide.md')
    send(`${CLAUDE}/pdf/references`, 'change', 'guide.md')
    expect(emitted).toEqual([])
    vi.advanceTimersByTime(DELAY_MS)
    expect(emitted).toEqual([
      { paths: [`${CLAUDE}/pdf/references/guide.md`], library: false },
    ])
    await vi.advanceTimersByTimeAsync(0)
    expect(lists()).toBe(scansAtStart)
  })

  it('follows a skill that is added: tells the Library and starts watching its folder', async () => {
    const { controller, emitted, exist, send, edit, opened } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    edit({ ...BASE, [`${CLAUDE}/docx/SKILL.md`]: skillText('docx') })
    exist(`${CLAUDE}/docx`)
    send(CLAUDE, 'rename', 'docx')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted[0]).toEqual({
      paths: [`${CLAUDE}/docx`],
      library: true,
    })
    expect(opened.has(`${CLAUDE}/docx`)).toBe(true)
  })

  it('watches a folder that is not a skill yet, so the SKILL.md written after the mkdir is seen', async () => {
    const { controller, emitted, exist, send, edit, opened } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    edit({ ...BASE, [`${CLAUDE}/docx`]: emptyDirectory })
    exist(`${CLAUDE}/docx`)
    send(CLAUDE, 'rename', 'docx')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(opened.has(`${CLAUDE}/docx`)).toBe(true)
    emitted.length = 0
    edit({
      ...BASE,
      [`${CLAUDE}/docx/SKILL.md`]: skillText('docx'),
    })
    send(`${CLAUDE}/docx`, 'rename', 'SKILL.md')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted).toEqual([
      { paths: [`${CLAUDE}/docx/SKILL.md`], library: true },
    ])
  })

  it('watches a link to a folder that is empty so far, and where it points', async () => {
    const { controller, opened, exist } = setup({
      ...BASE,
      [`${CLAUDE}/shared`]: link('/work/repo/skills/shared'),
      '/work/repo/skills/shared': emptyDirectory,
    })
    exist(...PDF_FOLDERS, '/work/repo/skills', '/work/repo/skills/shared')
    await controller.start()
    expect(opened.has('/work/repo/skills/shared')).toBe(true)
    expect(opened.has('/work/repo/skills')).toBe(true)
  })

  it('tells the Library when the scan after opening watches finds a different listing', async () => {
    const { controller, emitted, exist, edit, list } = setup(BASE)
    exist(...PDF_FOLDERS)
    const original = list.getMockImplementation()
    list.mockImplementationOnce(async () => {
      const snapshot = await original?.()
      edit({ ...BASE, [`${CLAUDE}/docx/SKILL.md`]: skillText('docx') })
      return snapshot as LibrarySnapshot
    })
    await controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(emitted).toEqual([{ paths: [], library: true }])
  })

  it('does not scan in a loop when nothing changed after opening the watches', async () => {
    const { controller, exist, lists } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    await vi.advanceTimersByTimeAsync(DELAY_MS * 10)
    expect(lists()).toBe(2)
  })

  it('stops watching the folder of a skill that was removed', async () => {
    const { controller, exist, send, edit, opened } = setup(BASE)
    exist(...PDF_FOLDERS)
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
    const { controller, emitted, exist, send, edit, opened } = setup(
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
    expect(emitted[0]).toEqual({
      paths: ['/work/repo/skills/shared'],
      library: true,
    })
    expect(opened.has('/work/repo/skills/shared')).toBe(true)
  })

  it('watches where a root that does not exist yet would appear', async () => {
    const { controller, opened, exist } = setup({})
    exist('/home/u/.claude')
    await controller.start()
    expect(opened.has('/home/u/.claude')).toBe(true)
  })

  it('sees a missing root come back under a hidden folder, whose name an ordinary event would drop', async () => {
    const { controller, emitted, exist, send, edit, opened } = setup({})
    exist('/home/u')
    await controller.start()
    expect(opened.has('/home/u')).toBe(true)
    send('/home/u', 'rename', '.cache')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted).toEqual([])
    edit({ ...BASE })
    exist('/home/u', '/home/u/.claude', ...PDF_FOLDERS)
    send('/home/u', 'rename', '.claude')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted[0]).toEqual({ paths: ['/home/u/.claude'], library: true })
    expect(opened.has(CLAUDE)).toBe(true)
  })

  it('sees a link target come back inside a hidden folder', async () => {
    const { controller, emitted, exist, send, edit } = setup(
      { [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf') },
      { [CLAUDE]: ['/work/.store/shared'] },
    )
    exist(CLAUDE, `${CLAUDE}/pdf`, '/work')
    await controller.start()
    edit({
      [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf'),
      [`${CLAUDE}/shared`]: link('/work/.store/shared'),
      '/work/.store/shared/SKILL.md': skillText('shared'),
    })
    send('/work', 'rename', '.store')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted[0]).toEqual({ paths: ['/work/.store'], library: true })
  })

  it('watches the folder of the open file, even outside every root', async () => {
    const { controller, opened, exist } = setup(BASE)
    exist(...PDF_FOLDERS, '/notes')
    await controller.start()
    await controller.watchFile('/notes/idea.md')
    expect(opened.has('/notes')).toBe(true)
    await controller.watchFile(null)
    expect(opened.has('/notes')).toBe(false)
  })

  it('keeps the file asked for last when the answers of the real path come back out of order', async () => {
    const { controller, opened, exist, slowRealPath } = setup(BASE)
    exist(...PDF_FOLDERS, '/notes', '/drafts')
    await controller.start()
    const answerFirst = slowRealPath('/notes/a.md')
    const first = controller.watchFile('/notes/a.md')
    const second = controller.watchFile('/drafts/b.md')
    await second
    answerFirst('/notes/a.md')
    await first
    await vi.advanceTimersByTimeAsync(0)
    expect(opened.has('/drafts')).toBe(true)
    expect(opened.has('/notes')).toBe(false)
  })

  it('does not bring a file back after it was told to stop watching', async () => {
    const { controller, opened, exist, slowRealPath } = setup(BASE)
    exist(...PDF_FOLDERS, '/notes')
    await controller.start()
    const answer = slowRealPath('/notes/a.md')
    const first = controller.watchFile('/notes/a.md')
    const stop = controller.watchFile(null)
    await stop
    answer('/notes/a.md')
    await first
    await vi.advanceTimersByTimeAsync(0)
    expect(opened.has('/notes')).toBe(false)
  })

  it('reopens the watch of a folder that was deleted and made again', async () => {
    const { controller, opened, exist, recreate, send } = setup(BASE)
    exist(...PDF_FOLDERS)
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
    exist(...PDF_FOLDERS)
    await controller.start()
    send(`${CLAUDE}/pdf`, 'rename', '.SKILL.md.3f2a.tmp')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(emitted).toEqual([])
  })

  it('scans again when a root is added or removed', async () => {
    const { controller, lists } = setup(BASE)
    await controller.start()
    const scansAtStart = lists()
    await controller.rootsChanged()
    expect(lists()).toBeGreaterThan(scansAtStart)
  })

  it('says so, and goes on, when the Library cannot be read', async () => {
    const { controller, list, problems } = setup(BASE)
    list.mockRejectedValueOnce(new Error('EIO'))
    await controller.start()
    expect(problems).toHaveLength(1)
    await controller.rootsChanged()
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('says so when a watch fails, without opening it again in a loop', async () => {
    const { controller, opened, exist, problems, lists } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    const scansAtStart = lists()
    opened.get(CLAUDE)?.failed(new Error('EPERM'))
    await vi.advanceTimersByTimeAsync(DELAY_MS * 5)
    expect(problems).toHaveLength(1)
    expect(lists()).toBe(scansAtStart)
  })

  it('goes quiet when closed', async () => {
    const { controller, opened, exist, send, emitted } = setup(BASE)
    exist(...PDF_FOLDERS)
    await controller.start()
    send(CLAUDE, 'rename', 'docx')
    controller.close()
    await vi.advanceTimersByTimeAsync(DELAY_MS * 5)
    expect(emitted).toEqual([])
    expect(opened.size).toBe(0)
  })
})
