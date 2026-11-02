import { countWords } from '../diff/count-words'
import type { Version, VersionSummary } from './types'
import { type WordDelta, wordDelta } from './word-delta'

const workedOut = new WeakMap<
  Version,
  { readonly previous: Version | undefined; readonly delta: WordDelta }
>()

const workOut = (
  version: Version,
  previous: Version | undefined,
): WordDelta => {
  const known = workedOut.get(version)
  if (known !== undefined && known.previous === previous) return known.delta
  const delta = wordDelta(previous?.text ?? '', version.text)
  workedOut.set(version, { previous, delta })
  return delta
}

const deltaOf = (version: Version, previous: Version | undefined): WordDelta =>
  version.wordsAdded !== undefined && version.wordsRemoved !== undefined
    ? { added: version.wordsAdded, removed: version.wordsRemoved }
    : workOut(version, previous)

export const summarize = (
  version: Version,
  previous?: Version,
): VersionSummary => {
  const { added, removed } = deltaOf(version, previous)
  return {
    id: version.id,
    at: version.at,
    cause: version.cause,
    words: countWords(version.text),
    wordsAdded: added,
    wordsRemoved: removed,
    ...(version.saved === undefined ? {} : { saved: version.saved }),
  }
}
