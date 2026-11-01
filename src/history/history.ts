import type { History, VersionCause, VersionId } from './types'
import { wordDelta } from './word-delta'

export const MAX_VERSIONS = 50

type VersionInput = {
  readonly text: string
  readonly cause: VersionCause
  readonly at: number
}

const deltaFields = (
  before: string,
  after: string,
): { readonly wordsAdded: number; readonly wordsRemoved: number } => {
  const { added, removed } = wordDelta(before, after)
  return { wordsAdded: added, wordsRemoved: removed }
}

export const startHistory = (text: string, at: number): History => [
  { id: 1, at, cause: { kind: 'started' }, text, ...deltaFields('', text) },
]

export const recordVersion = (
  history: History,
  { text, cause, at }: VersionInput,
): History => {
  const last = history.at(-1)
  if (last === undefined) return startHistory(text, at)
  if (last.text === text) return history
  return [
    ...history,
    { id: last.id + 1, at, cause, text, ...deltaFields(last.text, text) },
  ].slice(-MAX_VERSIONS)
}

export const markSaved = (
  history: History,
  {
    text,
    name,
    at,
  }: { readonly text: string; readonly name: string; readonly at: number },
): History => {
  const holding = (versions: History): number =>
    versions.findLastIndex((version) => version.text === text)
  const recorded =
    holding(history) < 0
      ? recordVersion(history, { text, cause: { kind: 'edited' }, at })
      : history
  const index = holding(recorded)
  return recorded.map((version, position) =>
    position === index ? { ...version, saved: name } : version,
  )
}

export const previousVersion = <T extends { readonly id: VersionId }>(
  versions: readonly T[],
  id: VersionId,
): T | undefined => {
  const index = versions.findIndex((version) => version.id === id)
  return index > 0 ? versions[index - 1] : undefined
}
