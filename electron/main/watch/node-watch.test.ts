import {
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WatchEvent } from './classify-changes'
import { createFolderWatcher } from './folder-watcher'
import {
  directoryIdentity,
  nodeDirectoryWatch,
  rootEntries,
} from './node-watch'

let dir = ''
let watching: ReturnType<typeof createFolderWatcher> | null = null

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'chiri-watch-')))
})

afterEach(async () => {
  watching?.close()
  watching = null
  await rm(dir, { recursive: true, force: true })
})

const watchDir = async (target: string) => {
  const events: WatchEvent[] = []
  watching = createFolderWatcher({
    watch: nodeDirectoryWatch,
    onEvent: (event) => events.push(event),
    onFailure: () => undefined,
  })
  const identity = await directoryIdentity(target)
  watching.sync(new Map([[target, identity ?? '']]))
  return events
}

const named = (events: readonly WatchEvent[], filename: string) =>
  events.some((event) => event.filename === filename)

describe('nodeDirectoryWatch', () => {
  it('sees a file written in place', async () => {
    await writeFile(join(dir, 'SKILL.md'), 'a')
    const events = await watchDir(dir)
    await writeFile(join(dir, 'SKILL.md'), 'b')
    await expect.poll(() => named(events, 'SKILL.md')).toBe(true)
  })

  it('sees a file replaced by write-temp-then-rename, under its final name', async () => {
    await writeFile(join(dir, 'SKILL.md'), 'a')
    const events = await watchDir(dir)
    await writeFile(join(dir, '.SKILL.md.tmp'), 'b')
    await rename(join(dir, '.SKILL.md.tmp'), join(dir, 'SKILL.md'))
    await expect
      .poll(() =>
        events.some(
          (event) =>
            event.filename === 'SKILL.md' && event.eventType === 'rename',
        ),
      )
      .toBe(true)
  })

  it('sees a file appear in the folder', async () => {
    const events = await watchDir(dir)
    await writeFile(join(dir, 'new.md'), 'x')
    await expect.poll(() => named(events, 'new.md')).toBe(true)
  })
})

describe('directoryIdentity', () => {
  it('changes when a folder is deleted and made again, which is when its watch goes quiet', async () => {
    const folder = join(dir, 'skill')
    await mkdir(folder)
    const before = await directoryIdentity(folder)
    const events = await watchDir(folder)
    await rm(folder, { recursive: true })
    await mkdir(folder)
    const after = await directoryIdentity(folder)
    expect(after).not.toBeNull()
    expect(after).not.toBe(before)
    events.length = 0
    await writeFile(join(folder, 'SKILL.md'), 'x')
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(named(events, 'SKILL.md')).toBe(false)
  })

  it('is null for a folder that is not there and for a file', async () => {
    await writeFile(join(dir, 'a.md'), 'x')
    expect(await directoryIdentity(join(dir, 'missing'))).toBeNull()
    expect(await directoryIdentity(join(dir, 'a.md'))).toBeNull()
  })
})

describe('rootEntries', () => {
  it('lists the real folder behind every folder and link, skill or not', async () => {
    await mkdir(join(dir, 'plain'))
    await mkdir(join(dir, 'real'))
    await symlink(join(dir, 'real'), join(dir, 'linked'))
    const { folders } = await rootEntries(dir)
    expect(folders.toSorted()).toEqual(
      [join(dir, 'plain'), join(dir, 'real'), join(dir, 'real')].toSorted(),
    )
  })

  it('leaves out hidden folders and node_modules, which a repository root holds', async () => {
    await mkdir(join(dir, '.git'))
    await mkdir(join(dir, 'node_modules'))
    await mkdir(join(dir, 'real'))
    await symlink(join(dir, 'real'), join(dir, '.hidden-link'))
    expect((await rootEntries(dir)).folders).toEqual([join(dir, 'real')])
  })

  it('still reports where a hidden link that points at nothing would come back', async () => {
    await symlink(join(dir, 'elsewhere', 'gone'), join(dir, '.gone'))
    expect((await rootEntries(dir)).dangling).toEqual([
      join(dir, 'elsewhere', 'gone'),
    ])
  })

  it('leaves out files and links to files', async () => {
    await writeFile(join(dir, 'a.md'), 'x')
    await symlink(join(dir, 'a.md'), join(dir, 'link.md'))
    expect(await rootEntries(dir)).toEqual({ folders: [], dangling: [] })
  })

  it('lists where each broken link points, resolved against the folder', async () => {
    await mkdir(join(dir, 'real'))
    await symlink(join(dir, 'real'), join(dir, 'fine'))
    await symlink(join(dir, 'elsewhere', 'gone'), join(dir, 'absolute'))
    await symlink('../sibling/gone', join(dir, 'relative'))
    const { dangling } = await rootEntries(dir)
    expect(dangling.toSorted()).toEqual(
      [join(dir, 'elsewhere', 'gone'), join(dir, '..', 'sibling', 'gone')]
        .map((path) => resolve(path))
        .toSorted(),
    )
  })

  it('has nothing to list for an empty folder', async () => {
    expect(await rootEntries(dir)).toEqual({ folders: [], dangling: [] })
  })
})
