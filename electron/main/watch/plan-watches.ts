import { dirname } from 'node:path'
import type { Skill } from '../../../src/skills/scan-skills'

type WatchPlanInput = {
  readonly roots: readonly string[]
  readonly skills: readonly Skill[]
  readonly openFile: string | null
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
}: WatchPlanInput): readonly string[] =>
  [
    ...new Set([
      ...roots,
      ...skills.flatMap(foldersOf),
      ...(openFile === null ? [] : [dirname(openFile)]),
    ]),
  ].toSorted()

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
