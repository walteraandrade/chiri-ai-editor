import { type ChangeObject, diffWords } from 'diff'
import { countWords } from '../diff/count-words'
import { lineRuns } from './line-runs'

export type WordDelta = { readonly added: number; readonly removed: number }

const MAX_WORD_EDITS = 400

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
