import { dirname } from 'node:path'
import type { Skill } from '../../../src/skills/scan-skills'

type WatchPlanInput = {
  readonly roots: readonly string[]
  readonly skills: readonly Skill[]
  readonly openFile: string | null
  readonly folders?: readonly string[]
  readonly anchors?: readonly string[]
}

export type WatchDiff = {
  readonly open: readonly string[]
  readonly close: readonly string[]
}

const foldersOf = (skill: Skill): readonly string[] => [
  skill.realPath,
  dirname(skill.realPath),
  ...skill.files.map((file) => dirname(file.path)),
]

export const watchDirectories = ({
  roots,
  skills,
  openFile,
  folders = [],
  anchors = [],
}: WatchPlanInput): readonly string[] =>
  [
    ...new Set([
      ...roots,
      ...folders.flatMap((folder) => [folder, dirname(folder)]),
      ...anchors,
      ...skills.flatMap(foldersOf),
      ...(openFile === null ? [] : [dirname(openFile)]),
    ]),
  ].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))

export const diffWatches = (
  active: ReadonlyMap<string, string>,
  wanted: ReadonlyMap<string, string>,
): WatchDiff => ({
  open: [...wanted].flatMap(([dir, identity]) =>
    active.get(dir) === identity ? [] : [dir],
  ),
  close: [...active].flatMap(([dir, identity]) =>
    wanted.get(dir) === identity ? [] : [dir],
  ),
})
