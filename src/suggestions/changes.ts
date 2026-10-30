import type { ReadySuggestion } from './types'

type ChangeSource = Pick<ReadySuggestion, 'from' | 'diff'>

export const changeSpots = ({ from, diff }: ChangeSource): readonly number[] =>
  diff.hunks.flatMap((hunk, index) => {
    const previous = diff.hunks[index - 1]
    if (hunk.type === 'equal' || (previous && previous.type !== 'equal'))
      return []
    return [from + (hunk.type === 'inserted' ? hunk.at : hunk.from)]
  })

export const stepChange = (
  spots: readonly number[],
  cursor: number,
  direction: 1 | -1,
): number | undefined =>
  direction === 1
    ? (spots.find((spot) => spot > cursor) ?? spots[0])
    : (spots.findLast((spot) => spot < cursor) ?? spots.at(-1))

export const changeLabel = (
  spots: readonly number[],
  cursor: number,
): string => {
  const index = spots.indexOf(cursor)
  if (index >= 0) return `Change ${index + 1} of ${spots.length}`
  return `${spots.length} ${spots.length === 1 ? 'change' : 'changes'}`
}

export const showsChanges = (
  suggestion: ChangeSource & Pick<ReadySuggestion, 'original'>,
): boolean =>
  changeSpots(suggestion).length >= 2 || suggestion.original.includes('\n')
