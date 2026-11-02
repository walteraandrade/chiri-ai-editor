import { describe, expect, it, vi } from 'vitest'
import type { WatchEvent } from './classify-changes'
import {
  createFolderWatcher,
  type DirectoryWatch,
  type WatchListener,
} from './folder-watcher'

type OpenWatch = {
  readonly dir: string
  readonly listener: WatchListener
  closed: boolean
}

const setup = (failToOpen: readonly string[] = []) => {
  const opened: OpenWatch[] = []
  const events: WatchEvent[] = []
  const failures: string[] = []
  const watch: DirectoryWatch = (dir, listener) => {
    if (failToOpen.includes(dir)) throw new Error('ENOSPC')
    const entry: OpenWatch = { dir, listener, closed: false }
    opened.push(entry)
    return {
      close: () => {
        entry.closed = true
      },
    }
  }
  const watcher = createFolderWatcher({
    watch,
    onEvent: (event) => events.push(event),
    onFailure: (dir) => failures.push(dir),
  })
  const ids = (entries: Record<string, string>) =>
    new Map(Object.entries(entries))
  const live = () => opened.filter((entry) => !entry.closed).map((e) => e.dir)
  return { watcher, opened, events, failures, ids, live }
}

describe('createFolderWatcher', () => {
  it('opens one watch per folder wanted', () => {
    const { watcher, ids, live } = setup()
    watcher.sync(ids({ '/a': '1:1', '/b': '1:2' }))
    expect(live()).toEqual(['/a', '/b'])
  })

  it('reports each event with the folder it came from', () => {
    const { watcher, ids, opened, events } = setup()
    watcher.sync(ids({ '/a': '1:1' }))
    opened[0]?.listener.event('rename', 'SKILL.md')
    expect(events).toEqual([
      { dir: '/a', eventType: 'rename', filename: 'SKILL.md' },
    ])
  })

  it('closes the watch of a folder nobody wants any more', () => {
    const { watcher, ids, live } = setup()
    watcher.sync(ids({ '/a': '1:1', '/b': '1:2' }))
    watcher.sync(ids({ '/b': '1:2' }))
    expect(live()).toEqual(['/b'])
  })

  it('keeps the watch of a folder that is still the same folder', () => {
    const { watcher, ids, opened } = setup()
    watcher.sync(ids({ '/a': '1:1' }))
    watcher.sync(ids({ '/a': '1:1' }))
    expect(opened).toHaveLength(1)
  })

  it('opens a new watch when the folder was deleted and made again', () => {
    const { watcher, ids, opened, live } = setup()
    watcher.sync(ids({ '/a': '1:1' }))
    watcher.sync(ids({ '/a': '1:9' }))
    expect(opened).toHaveLength(2)
    expect(opened[0]?.closed).toBe(true)
    expect(live()).toEqual(['/a'])
  })

  it('ignores what a closed watch still reports', () => {
    const { watcher, ids, opened, events } = setup()
    watcher.sync(ids({ '/a': '1:1' }))
    watcher.sync(ids({}))
    opened[0]?.listener.event('change', 'SKILL.md')
    expect(events).toEqual([])
  })

  it('reports a folder it could not watch, and tries again on the next sync', () => {
    const attempts: string[] = []
    const failures: string[] = []
    let failing = true
    const watcher = createFolderWatcher({
      watch: (dir) => {
        attempts.push(dir)
        if (failing) throw new Error('ENOSPC')
        return { close: () => undefined }
      },
      onEvent: () => undefined,
      onFailure: (dir) => failures.push(dir),
    })
    const wanted = new Map([['/a', '1:1']])
    watcher.sync(wanted)
    failing = false
    watcher.sync(wanted)
    expect(failures).toEqual(['/a'])
    expect(attempts).toEqual(['/a', '/a'])
  })

  it('drops a watch that fails later and reports it, so the next sync opens it again', () => {
    const { watcher, ids, opened, failures, live } = setup()
    watcher.sync(ids({ '/a': '1:1' }))
    opened[0]?.listener.failed(new Error('EPERM'))
    expect(failures).toEqual(['/a'])
    expect(live()).toEqual([])
    watcher.sync(ids({ '/a': '1:1' }))
    expect(live()).toEqual(['/a'])
  })

  it('closes everything and goes quiet when closed', () => {
    const { watcher, ids, opened, events, live } = setup()
    watcher.sync(ids({ '/a': '1:1' }))
    watcher.close()
    opened[0]?.listener.event('change', 'x.md')
    expect(live()).toEqual([])
    expect(events).toEqual([])
  })

  it('does not open anything after it was closed', () => {
    const { watcher, ids, opened } = setup()
    watcher.close()
    watcher.sync(ids({ '/a': '1:1' }))
    expect(opened).toEqual([])
  })

  it('does not throw when closing a watch fails', () => {
    const failures = vi.fn()
    const watcher = createFolderWatcher({
      watch: () => ({
        close: () => {
          throw new Error('already closed')
        },
      }),
      onEvent: () => undefined,
      onFailure: failures,
    })
    watcher.sync(new Map([['/a', '1:1']]))
    expect(() => watcher.sync(new Map())).not.toThrow()
  })
})
