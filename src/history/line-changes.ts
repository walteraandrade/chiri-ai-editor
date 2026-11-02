import { adaptiveDiff, type DiffHunk } from '../diff/adaptive-diff'
import { lineRuns } from './line-runs'

export type LineChange =
  | { readonly kind: 'same'; readonly lines: readonly string[] }
  | { readonly kind: 'changed'; readonly hunks: readonly DiffHunk[] }

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
