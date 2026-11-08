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

const SEPARATORS = /[\s\-_/.]/

const LINE_BREAKS = /\s*[\r\n]+\s*/g

export const isWordStart = (text: string, index: number): boolean =>
  index === 0 || SEPARATORS.test(text.charAt(index - 1))

const rangeAt = (start: number, length: number): MatchRange => ({
  start,
  end: start + length,
})

const indexesOf = (text: string, needle: string): readonly number[] => {
  const lower = text.toLowerCase()
  const found: number[] = []
  for (
    let at = lower.indexOf(needle);
    at !== -1;
    at = lower.indexOf(needle, at + 1)
  )
    found.push(at)
  return found
}

const prefixMatch = (text: string, needle: string): MatchRange | null =>
  text.toLowerCase().startsWith(needle) ? rangeAt(0, needle.length) : null

const wordMatch = (text: string, needle: string): MatchRange | null => {
  const at = indexesOf(text, needle).find((index) => isWordStart(text, index))
  return at === undefined ? null : rangeAt(at, needle.length)
}

const substringMatch = (text: string, needle: string): MatchRange | null => {
  const at = indexesOf(text, needle)[0]
  return at === undefined ? null : rangeAt(at, needle.length)
}

const oneLine = (text: string): string => text.replace(LINE_BREAKS, ' ').trim()

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
      const match = substringMatch(file.name, needle)
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
