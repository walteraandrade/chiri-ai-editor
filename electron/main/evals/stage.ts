import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { SKILL_FILE_NAME } from '../../../src/skills/scan-skills'
import { attempt } from './attempt'

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
}

const isInside = (root: string, path: string): boolean =>
  path === root || path.startsWith(`${root}${sep}`)

const copyEntry = async (
  state: CopyState,
  source: string,
  target: string,
  label: string,
  visited: ReadonlySet<string>,
): Promise<readonly string[]> => {
  const info = await attempt(() => lstat(source))
  if (info === undefined) return []
  if (info.isSymbolicLink()) {
    const real = await attempt(() => realpath(source))
    return real === undefined || !isInside(state.realRoot, real)
      ? [label]
      : copyEntry(state, real, target, label, visited)
  }
  if (info.isFile()) {
    await copyFile(source, target)
    return []
  }
  if (!info.isDirectory()) return [label]
  const real = await realpath(source)
  if (visited.has(real)) return [label]
  await mkdir(target)
  const next = new Set([...visited, real])
  const names = await readdir(source)
  const nested = await Promise.all(
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
  return nested.flat()
}

export const countEvals = async (skillDir: string): Promise<number> => {
  const evals = join(skillDir, 'evals')
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
  skillTextOverride?: string,
): Promise<Stage> => {
  const realRoot = await realpath(skillPath)
  const container = await mkdtemp(join(tempBase, 'desafinado-eval-'))
  const cleanup = (): Promise<void> =>
    rm(container, { recursive: true, force: true })
  try {
    const dir = join(container, basename(realRoot))
    await mkdir(dir)
    const state: CopyState = { realRoot }
    const names = await readdir(realRoot)
    const present = names.filter((name) => STAGE_EXCLUDED.includes(name))
    const skipped = await Promise.all(
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
    if (skillTextOverride !== undefined)
      await writeFile(join(dir, SKILL_FILE_NAME), skillTextOverride, 'utf8')
    const skillText = await readFile(join(dir, SKILL_FILE_NAME), 'utf8')
    const leftOut = [...present, ...skipped.flat()].toSorted((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    return {
      dir,
      skillText,
      caseCount: await countEvals(dir),
      leftOut,
      cleanup,
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}
