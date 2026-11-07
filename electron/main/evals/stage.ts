import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { SKILL_FILE_NAME } from '../../../src/skills/scan-skills'

export const STAGE_EXCLUDED: readonly string[] = [
  'hooks',
  '.claude-plugin',
  '.mcp.json',
  '.lsp.json',
  'settings.json',
  'agents',
  'commands',
]

export type Stage = {
  readonly dir: string
  readonly skillText: string
  readonly caseCount: number
  readonly leftOut: readonly string[]
  readonly cleanup: () => Promise<void>
}

type CopyState = {
  readonly realRoot: string
  readonly leftOut: string[]
}

const isInside = (root: string, path: string): boolean =>
  path === root || path.startsWith(`${root}${sep}`)

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

const copyEntry = async (
  state: CopyState,
  source: string,
  target: string,
  label: string,
  visited: ReadonlySet<string>,
): Promise<void> => {
  const info = await attempt(() => lstat(source))
  if (info === undefined) return
  if (info.isSymbolicLink()) {
    const real = await attempt(() => realpath(source))
    if (real === undefined || !isInside(state.realRoot, real)) {
      state.leftOut.push(label)
      return
    }
    return copyEntry(state, real, target, label, visited)
  }
  if (info.isFile()) {
    await copyFile(source, target)
    return
  }
  if (!info.isDirectory()) {
    state.leftOut.push(label)
    return
  }
  const real = await realpath(source)
  if (visited.has(real)) {
    state.leftOut.push(label)
    return
  }
  await mkdir(target)
  const next = new Set([...visited, real])
  const names = await readdir(source)
  await Promise.all(
    names.map((name) =>
      copyEntry(
        state,
        join(source, name),
        join(target, name),
        `${label}/${name}`,
        next,
      ),
    ),
  )
}

const countCases = async (stageDir: string): Promise<number> => {
  const evals = join(stageDir, 'evals')
  const names = (await attempt(() => readdir(evals))) ?? []
  const found = await Promise.all(
    names.map(async (name) => {
      const prompt = await attempt(() => lstat(join(evals, name, 'prompt.md')))
      return prompt?.isFile() === true
    }),
  )
  return found.filter(Boolean).length
}

export const stageSkill = async (
  skillPath: string,
  tempBase: string = tmpdir(),
): Promise<Stage> => {
  const realRoot = await realpath(skillPath)
  const container = await mkdtemp(join(tempBase, 'chiri-eval-'))
  const cleanup = (): Promise<void> =>
    rm(container, { recursive: true, force: true })
  try {
    const dir = join(container, basename(realRoot))
    await mkdir(dir)
    const state: CopyState = { realRoot, leftOut: [] }
    const names = await readdir(realRoot)
    const present = names.filter((name) => STAGE_EXCLUDED.includes(name))
    await Promise.all(
      names
        .filter((name) => !STAGE_EXCLUDED.includes(name))
        .map((name) =>
          copyEntry(
            state,
            join(realRoot, name),
            join(dir, name),
            name,
            new Set([realRoot]),
          ),
        ),
    )
    const skillText = await readFile(join(dir, SKILL_FILE_NAME), 'utf8')
    const leftOut = [...present, ...state.leftOut].toSorted()
    return {
      dir,
      skillText,
      caseCount: await countCases(dir),
      leftOut,
      cleanup,
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}
