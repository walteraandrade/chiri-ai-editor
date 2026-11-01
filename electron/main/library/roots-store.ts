import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { codeIs } from '../files/fs-failure'
import { writeAtomic } from '../files/write-atomic'
import { parseStoredRoots, serializeRoots } from './roots'

export const ROOTS_FILE_NAME = 'library-roots.json'

export type RootsStore = {
  readonly load: () => Promise<readonly string[]>
  readonly save: (projectRoots: readonly string[]) => Promise<void>
}

export const createRootsStore = (userDataDir: string): RootsStore => {
  const file = join(userDataDir, ROOTS_FILE_NAME)
  return {
    load: async () => {
      try {
        return parseStoredRoots(await readFile(file, 'utf8'))
      } catch (error) {
        if (codeIs(error, 'ENOENT')) return []
        throw error
      }
    },
    save: async (projectRoots) => {
      await writeAtomic(file, serializeRoots(projectRoots))
    },
  }
}
