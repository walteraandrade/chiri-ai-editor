import { dirname, relative, sep } from 'node:path'
import { createCoalescer } from '../../../src/document/coalescer'
import type { LibrarySnapshot } from '../../../src/skills/library'
import { sameLibrary } from '../../../src/skills/library-view'
import type { ExternalChanges } from '../../api'
import { createBatcher } from './batcher'
import {
  type AwaitedNames,
  classifyEvents,
  type WatchEvent,
} from './classify-changes'
import { createFolderWatcher, type DirectoryWatch } from './folder-watcher'
import type { RootEntries } from './node-watch'
import { watchDirectories } from './plan-watches'

export const DEFAULT_DELAY_MS = 250
export const DEFAULT_MAX_WAIT_MS = 1000

type ExternalChangesDeps = {
  readonly list: () => Promise<LibrarySnapshot>
  readonly realPath: (path: string) => Promise<string>
  readonly identityOf: (dir: string) => Promise<string | null>
  readonly watch: DirectoryWatch
  readonly rootEntries: (root: string) => Promise<RootEntries>
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

type Anchor = { readonly dir: string; readonly waitingFor: string }

type Plan = {
  readonly wanted: ReadonlyMap<string, string>
  readonly snapshot: LibrarySnapshot
  readonly awaited: AwaitedNames
}

const NO_ENTRIES: RootEntries = { folders: [], dangling: [] }

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

const awaitedBy = (anchors: readonly Anchor[]): AwaitedNames =>
  anchors.reduce<Map<string, Set<string>>>((names, { dir, waitingFor }) => {
    names.set(dir, new Set([...(names.get(dir) ?? []), waitingFor]))
    return names
  }, new Map())

export const createExternalChanges = ({
  list,
  realPath,
  identityOf,
  watch,
  rootEntries,
  emit,
  onProblem,
  delayMs = DEFAULT_DELAY_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
}: ExternalChangesDeps): ExternalChangesController => {
  let openFile: string | null = null
  let awaited: AwaitedNames = new Map()
  let latestWatchFile = 0
  let closed = false

  const watcher = createFolderWatcher({
    watch,
    onEvent: (event: WatchEvent) => batcher.add(event),
    onFailure: (dir, error) => onProblem(`Could not watch ${dir}`, error),
  })

  const existingAncestor = async (path: string): Promise<string> => {
    const parent = dirname(path)
    return (await identityOf(parent)) !== null || dirname(parent) === parent
      ? parent
      : existingAncestor(parent)
  }

  const anchorFor = async (missing: string): Promise<Anchor> => {
    const dir = await existingAncestor(missing)
    return { dir, waitingFor: relative(dir, missing).split(sep)[0] ?? '' }
  }

  const plan = async (): Promise<Plan> => {
    const snapshot = await list()
    const readable = snapshot.roots.filter((root) => root.readable)
    const real = await Promise.all(
      readable.map(
        async ({ root }) => (await attempt(() => realPath(root))) ?? root,
      ),
    )
    const entries = await Promise.all(
      real.map(
        async (root) => (await attempt(() => rootEntries(root))) ?? NO_ENTRIES,
      ),
    )
    const missing = snapshot.roots
      .filter(({ readable: ok }) => !ok)
      .map(({ root }) => root)
    const anchors = await Promise.all(
      [...missing, ...entries.flatMap(({ dangling }) => dangling)].map(
        anchorFor,
      ),
    )
    const dirs = watchDirectories({
      roots: real,
      skills: readable.flatMap(({ skills }) => skills),
      folders: entries.flatMap(({ folders }) => folders),
      openFile,
      anchors: anchors.map(({ dir }) => dir),
    })
    const identities = await Promise.all(
      dirs.map(async (dir) => [dir, await identityOf(dir)] as const),
    )
    return {
      snapshot,
      awaited: awaitedBy(anchors),
      wanted: new Map(
        identities.flatMap(([dir, identity]) =>
          identity === null ? [] : [[dir, identity] as const],
        ),
      ),
    }
  }

  const reconcile = createCoalescer(async () => {
    try {
      const { wanted, snapshot, awaited: names } = await plan()
      if (closed) return
      awaited = names
      if (watcher.sync(wanted) === 0) return
      const again = await list()
      if (closed || sameLibrary(snapshot, again)) return
      emit({ paths: [], library: true })
      void reconcile.request()
    } catch (error) {
      onProblem('Could not scan the skill folders to watch them', error)
    }
  })

  const batcher = createBatcher<WatchEvent>({
    delayMs,
    maxWaitMs,
    flush: (events) => {
      if (closed) return
      const changes = classifyEvents(events, openFile, { awaited })
      if (changes.paths.length === 0 && !changes.library) return
      emit(changes)
      if (changes.library) void reconcile.request()
    },
  })

  return {
    start: () => reconcile.request(),
    watchFile: async (path) => {
      const call = ++latestWatchFile
      const resolved =
        path === null ? null : ((await attempt(() => realPath(path))) ?? path)
      if (call !== latestWatchFile) return
      openFile = resolved
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
