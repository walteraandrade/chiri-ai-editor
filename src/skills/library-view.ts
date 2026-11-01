import type { LibraryListing } from './library'

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
