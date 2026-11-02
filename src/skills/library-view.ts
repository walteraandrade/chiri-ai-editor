import type { LibraryListing, LibrarySnapshot } from './library'

export type SkillChoices = Readonly<Record<string, boolean>>

export const skillCount = (roots: LibraryListing): number =>
  roots.reduce((total, { skills }) => total + skills.length, 0)

export const skillHoldingFile = (
  roots: LibraryListing,
  isOpenFile: (path: string) => boolean,
): string | undefined =>
  roots
    .flatMap(({ skills }) => skills)
    .find(({ files }) => files.some((file) => isOpenFile(file.path)))?.realPath

export const isSkillOpen = (
  choices: SkillChoices,
  realPath: string,
  holdingOpenFile: string | undefined,
): boolean => choices[realPath] ?? realPath === holdingOpenFile

export const skillFileLabel = (
  roots: LibraryListing,
  isOpenFile: (path: string) => boolean,
): string | undefined =>
  roots
    .flatMap(({ skills }) => skills)
    .flatMap((skill) =>
      skill.files
        .filter(({ path }) => isOpenFile(path))
        .map((file) => `${skill.name} / ${file.name}`),
    )
    .at(0)

export const sameLibrary = (
  left: LibrarySnapshot,
  right: LibrarySnapshot,
): boolean =>
  left.problem === right.problem &&
  JSON.stringify(left.roots) === JSON.stringify(right.roots)
