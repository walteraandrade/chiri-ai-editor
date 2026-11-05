import { readdir, readFile, realpath } from 'node:fs/promises'
import type {
  DirectoryEntry,
  SkillFileSystem,
} from '../../../src/skills/scan-skills'

const kindOf = (entry: {
  readonly isSymbolicLink: () => boolean
  readonly isDirectory: () => boolean
  readonly isFile: () => boolean
}): DirectoryEntry['kind'] =>
  entry.isSymbolicLink()
    ? 'symlink'
    : entry.isDirectory()
      ? 'directory'
      : entry.isFile()
        ? 'file'
        : 'other'

export const nodeSkillFileSystem: SkillFileSystem = {
  listDirectory: async (path) =>
    (await readdir(path, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      kind: kindOf(entry),
    })),
  realPath: (path) => realpath(path),
  readText: (path) => readFile(path, 'utf8'),
}
