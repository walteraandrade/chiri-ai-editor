import { type ArrayChange, diffArrays, diffWords } from 'diff'
import { adaptiveDiff, countWords, type DiffHunk } from '../diff/adaptive-diff'

export type LineChange =
  | { readonly kind: 'same'; readonly lines: readonly string[] }
  | { readonly kind: 'changed'; readonly hunks: readonly DiffHunk[] }

type Part = ArrayChange<string>

const linesOf = (text: string): string[] => text.replace(/\n+$/, '').split('\n')

const changedHunks = (removed: string, added: string): readonly DiffHunk[] =>
  removed === ''
    ? [{ type: 'inserted', text: added, at: 0 }]
    : added === ''
      ? [{ type: 'deleted', text: removed, from: 0, to: removed.length }]
      : adaptiveDiff(removed, added).hunks

const joined = (part: Part | undefined): string => part?.value.join('\n') ?? ''

export const lineChanges = (
  before: string,
  after: string,
): readonly LineChange[] => {
  const parts = diffArrays(linesOf(before), linesOf(after))
  return parts.flatMap((part, index): readonly LineChange[] => {
    if (!part.added && !part.removed)
      return [{ kind: 'same', lines: part.value }]
    if (part.added && parts[index - 1]?.removed) return []
    const next = parts[index + 1]
    const removed = part.removed ? part : undefined
    const added = part.added ? part : next?.added ? next : undefined
    return [
      { kind: 'changed', hunks: changedHunks(joined(removed), joined(added)) },
    ]
  })
}

export const wordDelta = (
  before: string,
  after: string,
): { readonly added: number; readonly removed: number } =>
  diffWords(before, after).reduce(
    (delta, part) => ({
      added: delta.added + (part.added ? countWords(part.value) : 0),
      removed: delta.removed + (part.removed ? countWords(part.value) : 0),
    }),
    { added: 0, removed: 0 },
  )
