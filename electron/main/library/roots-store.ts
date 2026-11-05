import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { codeIs } from '../files/fs-failure'
import { writeAtomic } from '../files/write-atomic'
import { parseStoredRoots, serializeRoots } from './roots'

export const ROOTS_FILE_NAME = 'library-roots.json'

export type RootsLoad =
  | { readonly kind: 'loaded'; readonly roots: readonly string[] }
  | { readonly kind: 'unreadable' }

export type RootsStore = {
  readonly load: () => Promise<RootsLoad>
  readonly save: (projectRoots: readonly string[]) => Promise<void>
}

const UNREADABLE = { kind: 'unreadable' } as const

export const createRootsStore = (userDataDir: string): RootsStore => {
  const file = join(userDataDir, ROOTS_FILE_NAME)
  return {
    load: async () => {
      try {
        const roots = parseStoredRoots(await readFile(file, 'utf8'))
        return roots === null ? UNREADABLE : { kind: 'loaded', roots }
      } catch (error) {
        return codeIs(error, 'ENOENT')
          ? { kind: 'loaded', roots: [] }
          : UNREADABLE
      }
    },
    save: async (projectRoots) => {
      await writeAtomic(file, serializeRoots(projectRoots))
    },
  }
}
