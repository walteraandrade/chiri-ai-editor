import type { LibraryListing } from './library'
import { SKILL_FILE_NAME, type Skill } from './scan-skills'

export const MAX_SEARCH_RESULTS = 12

export type MatchRange = { readonly start: number; readonly end: number }

export type SearchResult = {
  readonly id: string
  readonly kind: 'skill' | 'file'
  readonly path: string
  readonly label: string
  readonly labelMatch: MatchRange | null
  readonly detail: string | undefined
  readonly detailMatch: MatchRange | null
  readonly context: string | undefined
}

type Ranked = SearchResult & { readonly rank: number }

const SEPARATORS = /[\s\-_/.()[\]{},;:!?'"`“”‘’]/

export const isWordStart = (text: string, index: number): boolean =>
  index === 0 || SEPARATORS.test(text.charAt(index - 1))

type Folded = {
  readonly text: string
  readonly starts: readonly number[]
  readonly ends: readonly number[]
}

const fold = (text: string): Folded => {
  const chars = [...text]
  const lowers = chars.map((char) => char.toLowerCase())
  const offsets = chars.reduce<number[]>(
    (at, char, index) => {
      at.push((at[index] ?? 0) + char.length)
      return at
    },
    [0],
  )
  return {
    text: lowers.join(''),
    starts: lowers.flatMap((lower, index) =>
      Array<number>(lower.length).fill(offsets[index] ?? 0),
    ),
    ends: lowers.flatMap((lower, index) =>
      Array<number>(lower.length).fill(offsets[index + 1] ?? 0),
    ),
  }
}

const rangeIn = (
  folded: Folded,
  start: number,
  length: number,
): MatchRange => ({
  start: folded.starts[start] ?? start,
  end: folded.ends[start + length - 1] ?? start + length,
})

const matchAt = (
  text: string,
  needle: string,
  accept: (original: string, originalIndex: number) => boolean,
): MatchRange | null => {
  const folded = fold(text)
  for (
    let at = folded.text.indexOf(needle);
    at !== -1;
    at = folded.text.indexOf(needle, at + 1)
  ) {
    const original = folded.starts[at] ?? at
    if (folded.starts[at - 1] !== original && accept(text, original))
      return rangeIn(folded, at, needle.length)
  }
  return null
}

const prefixMatch = (text: string, needle: string): MatchRange | null => {
  const folded = fold(text)
  return folded.text.startsWith(needle)
    ? rangeIn(folded, 0, needle.length)
    : null
}

const wordMatch = (text: string, needle: string): MatchRange | null =>
  matchAt(text, needle, isWordStart)

const oneLine = (text: string): string =>
  text
    .split(/[\r\n]/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ')

const skillRow = (
  skill: Skill,
  path: string,
  rank: number,
  labelMatch: MatchRange | null,
  detailMatch: MatchRange | null,
  detail: string | undefined,
): Ranked => ({
  id: `skill:${skill.realPath}`,
  kind: 'skill',
  path,
  label: skill.name,
  labelMatch,
  detail,
  detailMatch,
  context: undefined,
  rank,
})

const skillResult = (skill: Skill, needle: string): Ranked | undefined => {
  const path = skill.files.find(({ name }) => name === SKILL_FILE_NAME)?.path
  if (path === undefined) return undefined
  const detail =
    skill.description === undefined ? undefined : oneLine(skill.description)
  const byName = prefixMatch(skill.name, needle)
  if (byName !== null) return skillRow(skill, path, 0, byName, null, detail)
  const byWord = wordMatch(skill.name, needle)
  if (byWord !== null) return skillRow(skill, path, 1, byWord, null, detail)
  const byDescription = detail === undefined ? null : wordMatch(detail, needle)
  return byDescription === null
    ? undefined
    : skillRow(skill, path, 3, null, byDescription, detail)
}

const fileResults = (skill: Skill, needle: string): readonly Ranked[] =>
  skill.files
    .filter(({ name, isMarkdown }) => isMarkdown && name !== SKILL_FILE_NAME)
    .flatMap((file): readonly Ranked[] => {
      const match = wordMatch(file.name, needle)
      return match === null
        ? []
        : [
            {
              id: `file:${file.path}`,
              kind: 'file',
              path: file.path,
              label: file.name,
              labelMatch: match,
              detail: undefined,
              detailMatch: null,
              context: skill.name,
              rank: 2,
            },
          ]
    })

const firstOfEach = (results: readonly Ranked[]): readonly Ranked[] =>
  results.filter(
    ({ id }, index) => results.findIndex((other) => other.id === id) === index,
  )

export const searchLibrary = (
  roots: LibraryListing,
  text: string,
): readonly SearchResult[] => {
  const needle = text.trim().toLowerCase()
  if (needle === '') return []
  const candidates = roots
    .flatMap(({ skills }) => skills)
    .flatMap((skill): readonly Ranked[] => {
      const own = skillResult(skill, needle)
      return [
        ...(own === undefined ? [] : [own]),
        ...fileResults(skill, needle),
      ]
    })
  return firstOfEach(candidates)
    .toSorted((a, b) => a.rank - b.rank)
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({ rank: _rank, ...result }) => result)
}
