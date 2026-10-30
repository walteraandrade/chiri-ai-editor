import { countWords } from '../diff/adaptive-diff'
import { DEFAULT_REVIEW_FOCUS } from '../suggestions/review'
import { previousVersion } from './history'
import { wordDelta } from './line-changes'
import type { AcceptedChange, History, Version, VersionCause } from './types'

export type VersionMark = 'ai' | 'you' | 'file' | 'restore'

export type VersionDescription = {
  readonly author: VersionMark
  readonly label: string
  readonly headline: string
}

export const markOf = (cause: VersionCause): VersionMark =>
  cause.kind === 'accepted'
    ? 'ai'
    : cause.kind === 'edited'
      ? 'you'
      : cause.kind === 'restored'
        ? 'restore'
        : 'file'

export const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`

export const changeLabel = (change: AcceptedChange): string =>
  change.origin === 'ask'
    ? change.instruction
    : change.instruction === DEFAULT_REVIEW_FOCUS
      ? 'Review pass'
      : `Review pass · ${change.instruction}`

export const mixedLabels = (changes: readonly AcceptedChange[]): boolean =>
  new Set(changes.map(changeLabel)).size > 1

export const listChanges = (
  changes: readonly AcceptedChange[],
): readonly {
  readonly key: string
  readonly label: string
  readonly rationale: string
}[] =>
  changes.map((change, position) => ({
    key: `${position}`,
    label: changeLabel(change),
    rationale: change.rationale,
  }))

const editedHeadline = (before: string, after: string): string => {
  const { added, removed } = wordDelta(before, after)
  if (added > 0 && removed > 0)
    return `You added ${plural(added, 'word')} and removed ${removed}`
  if (added > 0) return `You added ${plural(added, 'word')}`
  if (removed > 0) return `You removed ${plural(removed, 'word')}`
  return 'You changed spacing or formatting'
}

const editedHeadlines = new WeakMap<
  Version,
  { readonly before: string; readonly headline: string }
>()

const cachedEditedHeadline = (before: string, version: Version): string => {
  const cached = editedHeadlines.get(version)
  if (cached?.before === before) return cached.headline
  const headline = editedHeadline(before, version.text)
  editedHeadlines.set(version, { before, headline })
  return headline
}

const acceptedDescription = (
  changes: readonly AcceptedChange[],
): VersionDescription => {
  const labels = [...new Set(changes.map(changeLabel))]
  return {
    author: 'ai',
    label: `AI · ${labels.length === 1 ? labels[0] : 'Suggestions'}`,
    headline:
      changes.length === 1
        ? (changes[0]?.rationale ?? '')
        : `Accepted ${plural(changes.length, 'Suggestion')}`,
  }
}

export const describeVersion = (
  history: History,
  version: Version,
  formatTime: (at: number) => string,
): VersionDescription => {
  const { cause } = version
  switch (cause.kind) {
    case 'started':
      return {
        author: 'file',
        label: 'Started',
        headline: `Started with ${plural(countWords(version.text), 'word')}`,
      }
    case 'opened':
      return {
        author: 'file',
        label: 'Opened',
        headline: `Opened ${cause.name}`,
      }
    case 'edited':
      return {
        author: 'you',
        label: 'You',
        headline: cachedEditedHeadline(
          previousVersion(history, version.id)?.text ?? '',
          version,
        ),
      }
    case 'accepted':
      return acceptedDescription(cause.changes)
    case 'restored': {
      const source = history.find((item) => item.id === cause.from)
      return {
        author: 'restore',
        label: 'Restored',
        headline: source
          ? `Restored the Version from ${formatTime(source.at)}`
          : 'Restored an earlier Version',
      }
    }
  }
}

export const historySummary = (
  history: History,
): {
  readonly versions: number
  readonly fromAi: number
  readonly byYou: number
} => ({
  versions: history.length,
  fromAi: history.filter((version) => markOf(version.cause) === 'ai').length,
  byYou: history.filter((version) =>
    ['you', 'restore'].includes(markOf(version.cause)),
  ).length,
})
