import type { WatchEvent } from './classify-changes'
import { diffWatches } from './plan-watches'

export type WatchListener = {
  readonly event: (eventType: string, filename: string | null) => void
  readonly failed: (error: unknown) => void
}

export type WatchHandle = { readonly close: () => void }

export type DirectoryWatch = (
  dir: string,
  listener: WatchListener,
) => WatchHandle

type FolderWatcherOptions = {
  readonly watch: DirectoryWatch
  readonly onEvent: (event: WatchEvent) => void
  readonly onFailure: (dir: string, error: unknown) => void
}

export type FolderWatcher = {
  readonly sync: (wanted: ReadonlyMap<string, string>) => void
  readonly close: () => void
}

type Active = {
  readonly identity: string
  readonly handle: WatchHandle
}

const closeQuietly = ({ handle }: Active): void => {
  try {
    handle.close()
  } catch {
    return
  }
}

export const createFolderWatcher = ({
  watch,
  onEvent,
  onFailure,
}: FolderWatcherOptions): FolderWatcher => {
  const active = new Map<string, Active>()
  let closed = false

  const identities = (): ReadonlyMap<string, string> =>
    new Map([...active].map(([dir, { identity }]) => [dir, identity]))

  const open = (dir: string, identity: string): void => {
    let handle: WatchHandle | undefined
    const isCurrent = (): boolean =>
      handle !== undefined && active.get(dir)?.handle === handle
    try {
      handle = watch(dir, {
        event: (eventType, filename) => {
          if (isCurrent()) onEvent({ dir, eventType, filename })
        },
        failed: (error) => {
          if (!isCurrent()) return
          const entry = active.get(dir)
          active.delete(dir)
          if (entry !== undefined) closeQuietly(entry)
          onFailure(dir, error)
        },
      })
    } catch (error) {
      onFailure(dir, error)
      return
    }
    active.set(dir, { identity, handle })
  }

  const shut = (dir: string): void => {
    const entry = active.get(dir)
    active.delete(dir)
    if (entry !== undefined) closeQuietly(entry)
  }

  return {
    sync: (wanted) => {
      if (closed) return
      const { open: toOpen, close: toClose } = diffWatches(identities(), wanted)
      for (const dir of toClose) shut(dir)
      for (const dir of toOpen) {
        const identity = wanted.get(dir)
        if (identity !== undefined) open(dir, identity)
      }
    },
    close: () => {
      closed = true
      for (const dir of [...active.keys()]) shut(dir)
    },
  }
}
