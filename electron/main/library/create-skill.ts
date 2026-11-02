import { mkdir, realpath, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CreateSkillResult } from '../../../src/skills/library'
import { SKILL_FILE_NAME } from '../../../src/skills/scan-skills'
import { checkSkillName } from '../../../src/skills/skill-frontmatter'
import { skillTemplate } from '../../../src/skills/skill-template'
import { codeIs, describeFailure } from '../files/fs-failure'
import { writeAtomic } from '../files/write-atomic'
import { parseCreateSkillRequest } from './create-skill-request'
import { defaultRoots } from './roots'
import { ROOTS_FILE_NAME, type RootsStore } from './roots-store'

export type CreateSkillFs = {
  readonly makeDirectory: (path: string) => Promise<void>
  readonly removeDirectory: (path: string) => Promise<void>
  readonly writeFile: (path: string, text: string) => Promise<void>
  readonly realPath: (path: string) => Promise<string>
}

export type CreateSkillDeps = {
  readonly home: string
  readonly store: RootsStore
  readonly fileSystem: CreateSkillFs
}

export const nodeCreateSkillFs: CreateSkillFs = {
  makeDirectory: async (path) => {
    await mkdir(path)
  },
  removeDirectory: (path) => rmdir(path),
  writeFile: async (path, text) => {
    await writeAtomic(path, text)
  },
  realPath: (path) => realpath(path),
}

const failed = (reason: string): CreateSkillResult => ({
  kind: 'failed',
  reason,
})

const INVALID = failed('Invalid request')

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

const makeFolder = async (
  fileSystem: CreateSkillFs,
  folder: string,
  name: string,
): Promise<CreateSkillResult | null> => {
  try {
    await fileSystem.makeDirectory(folder)
    return null
  } catch (error) {
    return failed(
      codeIs(error, 'EEXIST')
        ? `A folder named "${name}" already exists there`
        : codeIs(error, 'ENOENT')
          ? 'Folder not found'
          : describeFailure(error),
    )
  }
}

export const createSkill = async (
  { home, store, fileSystem }: CreateSkillDeps,
  input: unknown,
): Promise<CreateSkillResult> => {
  const request = parseCreateSkillRequest(input)
  if (request === null) return INVALID
  const name = request.name.trim()
  const [problem] = checkSkillName(name)
  if (problem !== undefined) return failed(problem.message)
  const loaded = await store.load()
  if (loaded.kind === 'unreadable')
    return failed(`Could not read ${ROOTS_FILE_NAME}`)
  if (![...defaultRoots(home), ...loaded.roots].includes(request.root))
    return failed('Not a Library folder')
  const folder = join(request.root, name)
  const refused = await makeFolder(fileSystem, folder, name)
  if (refused !== null) return refused
  const file = join(folder, SKILL_FILE_NAME)
  try {
    await fileSystem.writeFile(file, skillTemplate(name))
  } catch (error) {
    await attempt(() => fileSystem.removeDirectory(folder))
    return failed(describeFailure(error))
  }
  return {
    kind: 'created',
    path: (await attempt(() => fileSystem.realPath(file))) ?? file,
    name,
  }
}
