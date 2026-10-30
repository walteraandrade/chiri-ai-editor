import { type ArrayChange, diffArrays, diffWords } from 'diff'
import { adaptiveDiff, type DiffHunk } from '../diff/adaptive-diff'

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
  const changes: LineChange[] = []
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (part === undefined) continue
    if (!part.added && !part.removed) {
      changes.push({ kind: 'same', lines: part.value })
      continue
    }
    const next = parts[index + 1]
    const paired =
      next !== undefined &&
      next.added !== part.added &&
      (next.added || next.removed)
    const removed = part.removed ? part : paired ? next : undefined
    const added = part.added ? part : paired ? next : undefined
    if (paired) index++
    changes.push({
      kind: 'changed',
      hunks: changedHunks(joined(removed), joined(added)),
    })
  }
  return changes
}

const countWords = (text: string): number =>
  text.split(/\s+/).filter((word) => word !== '').length

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
