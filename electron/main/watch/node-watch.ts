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

export const danglingLinkTargets = async (
  root: string,
): Promise<readonly string[]> => {
  const entries = await readdir(root, { withFileTypes: true })
  const targets = await Promise.all(
    entries
      .filter((entry) => entry.isSymbolicLink())
      .map(async (entry): Promise<readonly string[]> => {
        const link = join(root, entry.name)
        try {
          await realpath(link)
          return []
        } catch {
          try {
            return [resolve(root, await readlink(link))]
          } catch {
            return []
          }
        }
      }),
  )
  return targets.flat()
}
