import {
  type ArrayChange,
  type ChangeObject,
  diffArrays,
  diffWords,
} from 'diff'
import { adaptiveDiff, countWords, type DiffHunk } from '../diff/adaptive-diff'

export type LineChange =
  | { readonly kind: 'same'; readonly lines: readonly string[] }
  | { readonly kind: 'changed'; readonly hunks: readonly DiffHunk[] }

type LineRun =
  | { readonly kind: 'same'; readonly lines: readonly string[] }
  | {
      readonly kind: 'changed'
      readonly removed: string
      readonly added: string
    }

type WordDelta = { readonly added: number; readonly removed: number }

type Part = ArrayChange<string>

const MAX_WORD_EDITS = 400

const linesOf = (text: string): string[] => text.replace(/\n+$/, '').split('\n')

const joined = (part: Part | undefined): string => part?.value.join('\n') ?? ''

const lineRuns = (before: string, after: string): readonly LineRun[] => {
  const parts = diffArrays(linesOf(before), linesOf(after))
  return parts.flatMap((part, index): readonly LineRun[] => {
    if (!part.added && !part.removed)
      return [{ kind: 'same', lines: part.value }]
    if (part.added && parts[index - 1]?.removed) return []
    const next = parts[index + 1]
    const removed = part.removed ? part : undefined
    const added = part.added ? part : next?.added ? next : undefined
    return [{ kind: 'changed', removed: joined(removed), added: joined(added) }]
  })
}

const changedHunks = (removed: string, added: string): readonly DiffHunk[] =>
  removed === ''
    ? [{ type: 'inserted', text: added, at: 0 }]
    : added === ''
      ? [{ type: 'deleted', text: removed, from: 0, to: removed.length }]
      : adaptiveDiff(removed, added).hunks

export const lineChanges = (
  before: string,
  after: string,
): readonly LineChange[] =>
  lineRuns(before, after).map((run) =>
    run.kind === 'same'
      ? run
      : { kind: 'changed', hunks: changedHunks(run.removed, run.added) },
  )

const sumParts = (parts: readonly ChangeObject<string>[]): WordDelta =>
  parts.reduce(
    (delta, part) => ({
      added: delta.added + (part.added ? countWords(part.value) : 0),
      removed: delta.removed + (part.removed ? countWords(part.value) : 0),
    }),
    { added: 0, removed: 0 },
  )

const runDelta = (removed: string, added: string): WordDelta => {
  const parts = diffWords(removed, added, { maxEditLength: MAX_WORD_EDITS })
  return parts === undefined
    ? { added: countWords(added), removed: countWords(removed) }
    : sumParts(parts)
}

export const wordDelta = (before: string, after: string): WordDelta =>
  lineRuns(before, after).reduce(
    (total, run) => {
      if (run.kind === 'same') return total
      const delta = runDelta(run.removed, run.added)
      return {
        added: total.added + delta.added,
        removed: total.removed + delta.removed,
      }
    },
    { added: 0, removed: 0 },
  )
