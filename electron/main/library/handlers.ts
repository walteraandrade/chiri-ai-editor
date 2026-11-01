import type {
  AddRootResult,
  LibrarySnapshot,
  RemoveRootResult,
} from '../../../src/skills/library'
import {
  type SkillFileSystem,
  scanSkillRoots,
} from '../../../src/skills/scan-skills'
import { parsePathRequest } from '../files/requests'
import { defaultRoots, displayPath, withoutRoot, withRoot } from './roots'
import { ROOTS_FILE_NAME, type RootsStore } from './roots-store'

export type LibraryDeps = {
  readonly home: string
  readonly store: RootsStore
  readonly fileSystem: SkillFileSystem
}

const INVALID = { kind: 'failed', reason: 'Invalid request' } as const

const ROOTS_PROBLEM = `Could not read ${ROOTS_FILE_NAME}`

const UNREADABLE_ROOTS = { kind: 'failed', reason: ROOTS_PROBLEM } as const

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

export const listLibrary = async ({
  home,
  store,
  fileSystem,
}: LibraryDeps): Promise<LibrarySnapshot> => {
  const defaults = defaultRoots(home)
  const loaded = await store.load()
  const projectRoots = loaded.kind === 'loaded' ? loaded.roots : []
  const scans = await scanSkillRoots(fileSystem, [...defaults, ...projectRoots])
  return {
    roots: scans.map((scan) => ({
      ...scan,
      label: displayPath(scan.root, home),
      removable: !defaults.includes(scan.root),
    })),
    problem: loaded.kind === 'loaded' ? null : ROOTS_PROBLEM,
  }
}

const realPathOrSelf = async (
  fileSystem: SkillFileSystem,
  path: string,
): Promise<string> => (await attempt(() => fileSystem.realPath(path))) ?? path

export const addLibraryRoot = async (
  { home, store, fileSystem }: LibraryDeps,
  pick: () => Promise<string | null>,
): Promise<AddRootResult> => {
  if ((await store.load()).kind === 'unreadable') return UNREADABLE_ROOTS
  const picked = await pick()
  if (picked === null) return { kind: 'cancelled' }
  const chosen = parsePathRequest(picked)
  if (chosen === null) return INVALID
  const real = await attempt(() => fileSystem.realPath(chosen))
  if (
    real === undefined ||
    (await attempt(() => fileSystem.listDirectory(real))) === undefined
  )
    return { kind: 'failed', reason: 'Not a readable folder' }
  const label = displayPath(real, home)
  const loaded = await store.load()
  if (loaded.kind === 'unreadable') return UNREADABLE_ROOTS
  const projectRoots = loaded.roots
  const listed = await Promise.all(
    [...defaultRoots(home), ...projectRoots].map((root) =>
      realPathOrSelf(fileSystem, root),
    ),
  )
  if (listed.includes(real)) return { kind: 'duplicate', label }
  try {
    await store.save(withRoot(projectRoots, real))
  } catch {
    return { kind: 'failed', reason: 'Could not keep the roots' }
  }
  return { kind: 'added', label }
}

export const removeLibraryRoot = async (
  { store }: LibraryDeps,
  input: unknown,
): Promise<RemoveRootResult> => {
  const path = parsePathRequest(input)
  if (path === null) return INVALID
  const loaded = await store.load()
  if (loaded.kind === 'unreadable') return UNREADABLE_ROOTS
  const projectRoots = loaded.roots
  if (!projectRoots.includes(path))
    return { kind: 'failed', reason: 'Not a project root' }
  try {
    await store.save(withoutRoot(projectRoots, path))
  } catch {
    return { kind: 'failed', reason: 'Could not keep the roots' }
  }
  return { kind: 'removed' }
}
