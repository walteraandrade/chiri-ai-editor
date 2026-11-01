import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { KeyFile } from './key-store'

const OWNER_ONLY = 0o600

const isMissing = (error: unknown): boolean =>
  (error as { code?: unknown }).code === 'ENOENT'

export const createKeyFile = (path: string): KeyFile => ({
  read: () =>
    readFile(path, 'utf8').catch((error: unknown) => {
      if (isMissing(error)) return null
      throw error
    }),
  write: async (content) => {
    const temporary = `${path}.${process.pid}.tmp`
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, content, { mode: OWNER_ONLY })
    await rename(temporary, path)
  },
  remove: () => rm(path, { force: true }),
})
