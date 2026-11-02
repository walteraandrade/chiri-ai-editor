import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
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
