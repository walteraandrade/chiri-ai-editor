import type {
  AddRootResult,
  LibraryListing,
  RemoveRootResult,
} from '../../../src/skills/library'
import {
  type SkillFileSystem,
  scanSkillRoots,
} from '../../../src/skills/scan-skills'
import { parsePathRequest } from '../files/requests'
import { defaultRoots, displayPath, withoutRoot, withRoot } from './roots'
import type { RootsStore } from './roots-store'

export type LibraryDeps = {
  readonly home: string
  readonly store: RootsStore
  readonly fileSystem: SkillFileSystem
}

const INVALID = { kind: 'failed', reason: 'Invalid request' } as const

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
}: LibraryDeps): Promise<LibraryListing> => {
  const defaults = defaultRoots(home)
  const projectRoots = await store.load()
  const scans = await scanSkillRoots(fileSystem, [...defaults, ...projectRoots])
  return scans.map((scan) => ({
    ...scan,
    label: displayPath(scan.root, home),
    removable: !defaults.includes(scan.root),
  }))
}

const realPathOrSelf = async (
  fileSystem: SkillFileSystem,
  path: string,
): Promise<string> => (await attempt(() => fileSystem.realPath(path))) ?? path

export const addLibraryRoot = async (
  { home, store, fileSystem }: LibraryDeps,
  pick: () => Promise<string | null>,
): Promise<AddRootResult> => {
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
  const projectRoots = await store.load()
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
  const projectRoots = await store.load()
  if (!projectRoots.includes(path))
    return { kind: 'failed', reason: 'Not a project root' }
  try {
    await store.save(withoutRoot(projectRoots, path))
  } catch {
    return { kind: 'failed', reason: 'Could not keep the roots' }
  }
  return { kind: 'removed' }
}
