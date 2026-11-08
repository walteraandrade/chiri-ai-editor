import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

export type ExecutableCheck = (path: string) => Promise<boolean>

export const isExecutableFile: ExecutableCheck = async (path) => {
  try {
    if (!(await stat(path)).isFile()) return false
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export type FindClaudeInput = {
  readonly path: string | undefined
  readonly home: string
  readonly isExecutable: ExecutableCheck
}

export const candidatePaths = (
  path: string | undefined,
  home: string,
): readonly string[] => [
  ...(path ?? '')
    .split(delimiter)
    .filter((directory) => directory !== '')
    .map((directory) => join(directory, 'claude')),
  join(home, '.local', 'bin', 'claude'),
]

export const findClaude = async ({
  path,
  home,
  isExecutable,
}: FindClaudeInput): Promise<string | null> => {
  for (const candidate of candidatePaths(path, home))
    if (await isExecutable(candidate)) return candidate
  return null
}
