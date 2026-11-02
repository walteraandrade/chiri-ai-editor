import { watch } from 'node:fs'
import { readdir, readlink, realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { DirectoryWatch } from './folder-watcher'

export const nodeDirectoryWatch: DirectoryWatch = (dir, listener) => {
  const watcher = watch(dir, { persistent: false }, (eventType, filename) =>
    listener.event(eventType, filename),
  )
  watcher.on('error', listener.failed)
  return { close: () => watcher.close() }
}

export const directoryIdentity = async (
  dir: string,
): Promise<string | null> => {
  try {
    const info = await stat(dir)
    return info.isDirectory() ? `${info.dev}:${info.ino}` : null
  } catch {
    return null
  }
}

export type RootEntries = {
  readonly folders: readonly string[]
  readonly dangling: readonly string[]
}

const isFolder = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

const describeEntry = async (
  root: string,
  entry: {
    readonly name: string
    isDirectory(): boolean
    isSymbolicLink(): boolean
  },
): Promise<RootEntries> => {
  const path = join(root, entry.name)
  if (entry.isDirectory()) return { folders: [path], dangling: [] }
  if (!entry.isSymbolicLink()) return { folders: [], dangling: [] }
  try {
    const real = await realpath(path)
    return {
      folders: (await isFolder(real)) ? [real] : [],
      dangling: [],
    }
  } catch {
    try {
      return { folders: [], dangling: [resolve(root, await readlink(path))] }
    } catch {
      return { folders: [], dangling: [] }
    }
  }
}

export const rootEntries = async (root: string): Promise<RootEntries> => {
  const entries = await Promise.all(
    (await readdir(root, { withFileTypes: true })).map((entry) =>
      describeEntry(root, entry),
    ),
  )
  return {
    folders: entries.flatMap((entry) => entry.folders),
    dangling: entries.flatMap((entry) => entry.dangling),
  }
}
