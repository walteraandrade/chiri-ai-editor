import { type ChangeObject, diffWordsWithSpace } from 'diff'

export const BLOCK_LEVEL_THRESHOLD = 0.4

export type DiffHunk =
  | {
      readonly type: 'equal'
      readonly text: string
      readonly from: number
      readonly to: number
    }
  | {
      readonly type: 'deleted'
      readonly text: string
      readonly from: number
      readonly to: number
    }
  | {
      readonly type: 'inserted'
      readonly text: string
      readonly at: number
    }

export type DiffMode = 'word' | 'block'

export type AdaptiveDiff = {
  readonly mode: DiffMode
  readonly hunks: readonly DiffHunk[]
  readonly changedShare: number
}

type Chunk =
  | { readonly type: 'equal'; readonly text: string }
  | {
      readonly type: 'change'
      readonly deleted: string
      readonly inserted: string
    }

const isBlank = (text: string): boolean => text.trim() === ''

const toChunk = (part: ChangeObject<string>): Chunk =>
  part.added
    ? { type: 'change', deleted: '', inserted: part.value }
    : part.removed
      ? { type: 'change', deleted: part.value, inserted: '' }
      : { type: 'equal', text: part.value }

const joinChanges = (
  previous: Extract<Chunk, { type: 'change' }>,
  separator: string,
  next: Extract<Chunk, { type: 'change' }>,
): Chunk => ({
  type: 'change',
  deleted:
    previous.deleted + (previous.deleted ? separator : '') + next.deleted,
  inserted:
    previous.inserted + (previous.inserted ? separator : '') + next.inserted,
})

const pushChunk = (
  chunks: readonly Chunk[],
  chunk: Chunk,
): readonly Chunk[] => {
  if (chunk.type === 'equal') return [...chunks, chunk]
  const last = chunks.at(-1)
  if (last?.type === 'change')
    return [...chunks.slice(0, -1), joinChanges(last, '', chunk)]
  const beforeLast = chunks.at(-2)
  if (
    last?.type === 'equal' &&
    isBlank(last.text) &&
    beforeLast?.type === 'change'
  ) {
    return [...chunks.slice(0, -2), joinChanges(beforeLast, last.text, chunk)]
  }
  return [...chunks, chunk]
}

const toHunks = (chunks: readonly Chunk[]): readonly DiffHunk[] =>
  chunks.reduce<{ hunks: readonly DiffHunk[]; offset: number }>(
    ({ hunks, offset }, chunk) => {
      if (chunk.type === 'equal') {
        const to = offset + chunk.text.length
        return {
          hunks: [
            ...hunks,
            { type: 'equal', text: chunk.text, from: offset, to },
          ],
          offset: to,
        }
      }
      const to = offset + chunk.deleted.length
      return {
        hunks: [
          ...hunks,
          ...(chunk.deleted === ''
            ? []
            : [
                {
                  type: 'deleted' as const,
                  text: chunk.deleted,
                  from: offset,
                  to,
                },
              ]),
          ...(chunk.inserted === ''
            ? []
            : [{ type: 'inserted' as const, text: chunk.inserted, at: to }]),
        ],
        offset: to,
      }
    },
    { hunks: [], offset: 0 },
  ).hunks

export const countWords = (text: string): number =>
  text.split(/\s+/).filter((word) => word !== '').length

const sumWords = (hunks: readonly DiffHunk[], type: DiffHunk['type']): number =>
  hunks
    .filter((hunk) => hunk.type === type)
    .reduce((total, hunk) => total + countWords(hunk.text), 0)

export const changedShare = (hunks: readonly DiffHunk[]): number => {
  const changed = sumWords(hunks, 'deleted') + sumWords(hunks, 'inserted')
  const total = changed + 2 * sumWords(hunks, 'equal')
  return total === 0 ? 0 : changed / total
}

const blockHunks = (
  original: string,
  replacement: string,
): readonly DiffHunk[] => [
  ...(original === ''
    ? []
    : [
        {
          type: 'deleted' as const,
          text: original,
          from: 0,
          to: original.length,
        },
      ]),
  ...(replacement === ''
    ? []
    : [{ type: 'inserted' as const, text: replacement, at: original.length }]),
]

export const adaptiveDiff = (
  original: string,
  replacement: string,
): AdaptiveDiff => {
  const hunks = toHunks(
    diffWordsWithSpace(original, replacement)
      .map(toChunk)
      .reduce(pushChunk, []),
  )
  const share = changedShare(hunks)
  return share > BLOCK_LEVEL_THRESHOLD
    ? {
        mode: 'block',
        hunks: blockHunks(original, replacement),
        changedShare: share,
      }
    : { mode: 'word', hunks, changedShare: share }
}
