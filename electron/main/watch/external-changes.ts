import { dirname } from 'node:path'
import { createCoalescer } from '../../../src/document/coalescer'
import type { LibrarySnapshot } from '../../../src/skills/library'
import type { ExternalChanges } from '../../api'
import { createBatcher } from './batcher'
import { classifyEvents, type WatchEvent } from './classify-changes'
import { createFolderWatcher, type DirectoryWatch } from './folder-watcher'
import { watchDirectories } from './plan-watches'

export const DEFAULT_DELAY_MS = 250
export const DEFAULT_MAX_WAIT_MS = 1000

type ExternalChangesDeps = {
  readonly list: () => Promise<LibrarySnapshot>
  readonly realPath: (path: string) => Promise<string>
  readonly identityOf: (dir: string) => Promise<string | null>
  readonly watch: DirectoryWatch
  readonly danglingTargets: (root: string) => Promise<readonly string[]>
  readonly emit: (changes: ExternalChanges) => void
  readonly onProblem: (message: string, error: unknown) => void
  readonly delayMs?: number
  readonly maxWaitMs?: number
}

export type ExternalChangesController = {
  readonly start: () => Promise<void>
  readonly watchFile: (path: string | null) => Promise<void>
  readonly rootsChanged: () => Promise<void>
  readonly close: () => void
}

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

export const createExternalChanges = ({
  list,
  realPath,
  identityOf,
  watch,
  danglingTargets,
  emit,
  onProblem,
  delayMs = DEFAULT_DELAY_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
}: ExternalChangesDeps): ExternalChangesController => {
  let openFile: string | null = null
  let closed = false

  const watcher = createFolderWatcher({
    watch,
    onEvent: (event: WatchEvent) => batcher.add(event),
    onFailure: (dir, error) => onProblem(`Could not watch ${dir}`, error),
  })

  const nearestExisting = async (dir: string): Promise<string> => {
    const parent = dirname(dir)
    return (await identityOf(dir)) !== null || parent === dir
      ? dir
      : nearestExisting(parent)
  }

  const plan = async (): Promise<ReadonlyMap<string, string>> => {
    const { roots } = await list()
    const readable = roots.filter((root) => root.readable)
    const real = await Promise.all(
      readable.map(
        async ({ root }) => (await attempt(() => realPath(root))) ?? root,
      ),
    )
    const dangling = await Promise.all(
      real.map(
        async (root) => (await attempt(() => danglingTargets(root))) ?? [],
      ),
    )
    const missing = roots
      .filter(({ readable: ok }) => !ok)
      .map(({ root }) => root)
    const anchors = await Promise.all(
      [...missing, ...dangling.flat()].map((path) =>
        nearestExisting(dirname(path)),
      ),
    )
    const dirs = watchDirectories({
      roots: real,
      skills: readable.flatMap(({ skills }) => skills),
      openFile,
      anchors,
    })
    const identities = await Promise.all(
      dirs.map(async (dir) => [dir, await identityOf(dir)] as const),
    )
    return new Map(
      identities.flatMap(([dir, identity]) =>
        identity === null ? [] : [[dir, identity] as const],
      ),
    )
  }

  const reconcile = createCoalescer(async () => {
    try {
      const wanted = await plan()
      if (!closed) watcher.sync(wanted)
    } catch (error) {
      onProblem('Could not scan the skill folders to watch them', error)
    }
  })

  const batcher = createBatcher<WatchEvent>({
    delayMs,
    maxWaitMs,
    flush: (events) => {
      if (closed) return
      const changes = classifyEvents(events, openFile)
      if (changes.paths.length === 0 && !changes.library) return
      emit(changes)
      if (changes.library) void reconcile.request()
    },
  })

  return {
    start: () => reconcile.request(),
    watchFile: async (path) => {
      openFile =
        path === null ? null : ((await attempt(() => realPath(path))) ?? path)
      await reconcile.request()
    },
    rootsChanged: () => reconcile.request(),
    close: () => {
      closed = true
      batcher.cancel()
      watcher.close()
    },
  }
}
