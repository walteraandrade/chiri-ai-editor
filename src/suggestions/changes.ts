import type { DiffHunk } from '../diff/adaptive-diff'
import type { ReadySuggestion } from './types'

export type ChangeRange = { readonly from: number; readonly to: number }

type ChangeSource = Pick<ReadySuggestion, 'from' | 'diff'>

type ChangedHunk = Exclude<DiffHunk, { type: 'equal' }>

const isChanged = (hunk: DiffHunk | undefined): hunk is ChangedHunk =>
  hunk !== undefined && hunk.type !== 'equal'

const hunkStart = (hunk: ChangedHunk): number =>
  hunk.type === 'inserted' ? hunk.at : hunk.from

const hunkEnd = (hunk: ChangedHunk): number =>
  hunk.type === 'inserted' ? hunk.at : hunk.to

export const changeRanges = ({
  from,
  diff: { hunks },
}: ChangeSource): readonly ChangeRange[] => {
  const starts = hunks.filter(
    (hunk, index): hunk is ChangedHunk =>
      isChanged(hunk) && !isChanged(hunks[index - 1]),
  )
  const ends = hunks.filter(
    (hunk, index): hunk is ChangedHunk =>
      isChanged(hunk) && !isChanged(hunks[index + 1]),
  )
  return starts.map((start, index) => ({
    from: from + hunkStart(start),
    to: from + hunkEnd(ends[index] ?? start),
  }))
}

export const stepChange = (
  ranges: readonly ChangeRange[],
  cursor: number,
  direction: 1 | -1,
): number | undefined =>
  direction === 1
    ? (ranges.find((range) => range.from > cursor) ?? ranges[0])?.from
    : (ranges.findLast((range) => range.to < cursor) ?? ranges.at(-1))?.from

export const changeLabel = (
  ranges: readonly ChangeRange[],
  cursor: number,
): string => {
  const index = ranges.findIndex(
    (range) => range.from <= cursor && cursor <= range.to,
  )
  if (index >= 0) return `Change ${index + 1} of ${ranges.length}`
  return `${ranges.length} ${ranges.length === 1 ? 'change' : 'changes'}`
}

export const showsChanges = (
  suggestion: ChangeSource & Pick<ReadySuggestion, 'original'>,
): boolean =>
  changeRanges(suggestion).length >= 2 || suggestion.original.includes('\n')
