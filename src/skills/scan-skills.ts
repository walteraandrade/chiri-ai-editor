import { type FrontmatterProblem, readFrontmatter } from './frontmatter-fields'

export type DirectoryEntry = {
  readonly name: string
  readonly kind: 'file' | 'directory' | 'symlink' | 'other'
}

export type SkillFileSystem = {
  readonly listDirectory: (path: string) => Promise<readonly DirectoryEntry[]>
  readonly realPath: (path: string) => Promise<string>
  readonly readText: (path: string) => Promise<string>
}

export type SkillFile = {
  readonly path: string
  readonly name: string
  readonly isMarkdown: boolean
}

export type Skill = {
  readonly realPath: string
  readonly folderName: string
  readonly root: string
  readonly name: string
  readonly description: string | undefined
  readonly problem: FrontmatterProblem | undefined
  readonly files: readonly SkillFile[]
}

export type RootScan = {
  readonly root: string
  readonly readable: boolean
  readonly skills: readonly Skill[]
}

export type ScanOptions = {
  readonly maxDepth?: number
}

type Visit = {
  readonly directory: string
  readonly children: readonly DirectoryEntry[]
  readonly prefix: string
  readonly depth: number
  readonly ancestors: ReadonlySet<string>
}

export const SKILL_FILE_NAME = 'SKILL.md'

export const DEFAULT_MAX_DEPTH = 3

const BYTE_ORDER_MARK = /^﻿/

const LINE_BREAKS = /\r\n?/g

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

const joinPath = (directory: string, name: string): string =>
  `${directory.replace(/[\\/]+$/, '')}/${name}`

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

const compareIgnoringCase = (a: string, b: string): number =>
  compareText(a.toLowerCase(), b.toLowerCase()) || compareText(a, b)

const byName = (a: DirectoryEntry, b: DirectoryEntry): number =>
  compareIgnoringCase(a.name, b.name)

const isHidden = ({ name }: DirectoryEntry): boolean =>
  name.startsWith('.') || name === 'node_modules'

const isMarkdown = (name: string): boolean => name.toLowerCase().endsWith('.md')

const textOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const describeSkillFile = (text: string, folderName: string) => {
  const reading = readFrontmatter(
    text.replace(BYTE_ORDER_MARK, '').replace(LINE_BREAKS, '\n'),
  )
  const fields = reading.kind === 'present' ? reading.fields : {}
  return {
    name: textOrUndefined(fields.name) ?? folderName,
    description: textOrUndefined(fields.description),
    problem: reading.kind === 'invalid' ? reading.problem : undefined,
  }
}

const visitFiles = async (
  fileSystem: SkillFileSystem,
  maxDepth: number,
  { directory, children, prefix, depth, ancestors }: Visit,
): Promise<readonly SkillFile[]> => {
  const entries = children
    .filter((entry) => !isHidden(entry) && entry.kind !== 'other')
    .toSorted(byName)
  const found = await Promise.all(
    entries.map(async (entry): Promise<readonly SkillFile[]> => {
      const name = `${prefix}${entry.name}`
      const real = await attempt(() =>
        fileSystem.realPath(joinPath(directory, entry.name)),
      )
      if (real === undefined) return []
      const file: SkillFile = { path: real, name, isMarkdown: isMarkdown(name) }
      if (entry.kind === 'file') return [file]
      if (entry.kind === 'directory' && depth >= maxDepth) return []
      const nested = await attempt(() => fileSystem.listDirectory(real))
      if (nested === undefined) return entry.kind === 'symlink' ? [file] : []
      if (depth >= maxDepth || ancestors.has(real)) return []
      return visitFiles(fileSystem, maxDepth, {
        directory: real,
        children: nested,
        prefix: `${name}/`,
        depth: depth + 1,
        ancestors: new Set([...ancestors, real]),
      })
    }),
  )
  return found.flat()
}

const orderFiles = (files: readonly SkillFile[]): readonly SkillFile[] =>
  files
    .toSorted(
      (a, b) =>
        Number(b.name === SKILL_FILE_NAME) -
          Number(a.name === SKILL_FILE_NAME) ||
        compareIgnoringCase(a.name, b.name),
    )
    .filter(
      (file, index, sorted) =>
        sorted.findIndex(({ path }) => path === file.path) === index,
    )

const loadSkill = async (
  fileSystem: SkillFileSystem,
  maxDepth: number,
  root: string,
  folderName: string,
  realPath: string,
): Promise<Skill | undefined> => {
  const children = await attempt(() => fileSystem.listDirectory(realPath))
  const hasSkillFile = children?.some(
    ({ name, kind }) =>
      name === SKILL_FILE_NAME && (kind === 'file' || kind === 'symlink'),
  )
  if (children === undefined || !hasSkillFile) return undefined
  const skillFilePath = await attempt(() =>
    fileSystem.realPath(joinPath(realPath, SKILL_FILE_NAME)),
  )
  const text =
    skillFilePath === undefined
      ? undefined
      : await attempt(() => fileSystem.readText(skillFilePath))
  if (text === undefined) return undefined
  const files = await visitFiles(fileSystem, maxDepth, {
    directory: realPath,
    children,
    prefix: '',
    depth: 0,
    ancestors: new Set([realPath]),
  })
  return {
    realPath,
    folderName,
    root,
    ...describeSkillFile(text, folderName),
    files: orderFiles(files),
  }
}

const compareSkills = (a: Skill, b: Skill): number =>
  compareIgnoringCase(a.name, b.name) ||
  compareIgnoringCase(a.folderName, b.folderName)

type Candidate = { readonly folderName: string; readonly realPath: string }

type RootResult = {
  readonly scan: RootScan
  readonly claimed: ReadonlySet<string>
}

const scanRoot = async (
  fileSystem: SkillFileSystem,
  maxDepth: number,
  root: string,
  claimed: ReadonlySet<string>,
): Promise<RootResult> => {
  const entries = await attempt(() => fileSystem.listDirectory(root))
  if (entries === undefined)
    return { scan: { root, readable: false, skills: [] }, claimed }
  const resolved = await Promise.all(
    entries
      .filter(({ kind }) => kind === 'directory' || kind === 'symlink')
      .toSorted(byName)
      .map(async ({ name }) => ({
        folderName: name,
        realPath: await attempt(() =>
          fileSystem.realPath(joinPath(root, name)),
        ),
      })),
  )
  const fresh = resolved.reduce<{
    readonly seen: ReadonlySet<string>
    readonly candidates: readonly Candidate[]
  }>(
    ({ seen, candidates }, { folderName, realPath }) =>
      realPath === undefined || seen.has(realPath)
        ? { seen, candidates }
        : {
            seen: new Set([...seen, realPath]),
            candidates: [...candidates, { folderName, realPath }],
          },
    { seen: claimed, candidates: [] },
  )
  const skills = await Promise.all(
    fresh.candidates.map(({ folderName, realPath }) =>
      loadSkill(fileSystem, maxDepth, root, folderName, realPath),
    ),
  )
  return {
    scan: {
      root,
      readable: true,
      skills: skills
        .filter((skill): skill is Skill => skill !== undefined)
        .toSorted(compareSkills),
    },
    claimed: fresh.seen,
  }
}

export const scanSkillRoots = async (
  fileSystem: SkillFileSystem,
  roots: readonly string[],
  options: ScanOptions = {},
): Promise<readonly RootScan[]> => {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const { scans } = await roots.reduce<
    Promise<{
      readonly scans: readonly RootScan[]
      readonly claimed: ReadonlySet<string>
    }>
  >(
    async (previous, root) => {
      const { scans, claimed } = await previous
      const result = await scanRoot(fileSystem, maxDepth, root, claimed)
      return { scans: [...scans, result.scan], claimed: result.claimed }
    },
    Promise.resolve({ scans: [], claimed: new Set<string>() }),
  )
  return scans
}
