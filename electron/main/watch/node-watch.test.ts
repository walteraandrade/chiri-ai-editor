import {
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WatchEvent } from './classify-changes'
import { createFolderWatcher } from './folder-watcher'
import { directoryIdentity, nodeDirectoryWatch } from './node-watch'

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
