import { DEFAULT_REVIEW_FOCUS } from '../suggestions/review'
import type {
  AcceptedChange,
  VersionCause,
  VersionList,
  VersionSummary,
} from './types'

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

const editedHeadline = (added: number, removed: number): string => {
  if (added > 0 && removed > 0)
    return `You added ${plural(added, 'word')} and removed ${removed}`
  if (added > 0) return `You added ${plural(added, 'word')}`
  if (removed > 0) return `You removed ${plural(removed, 'word')}`
  return 'You changed spacing or formatting'
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
  versions: VersionList,
  version: VersionSummary,
  formatTime: (at: number) => string,
): VersionDescription => {
  const { cause } = version
  switch (cause.kind) {
    case 'started':
      return {
        author: 'file',
        label: 'Started',
        headline: `Started with ${plural(version.words, 'word')}`,
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
        headline: editedHeadline(version.wordsAdded, version.wordsRemoved),
      }
    case 'external':
      return {
        author: 'file',
        label: 'External',
        headline: 'Changed outside Chiri',
      }
    case 'accepted':
      return acceptedDescription(cause.changes)
    case 'restored': {
      const source = versions.find((item) => item.id === cause.from)
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
  versions: VersionList,
): {
  readonly versions: number
  readonly fromAi: number
  readonly byYou: number
} => ({
  versions: versions.length,
  fromAi: versions.filter((version) => markOf(version.cause) === 'ai').length,
  byYou: versions.filter((version) =>
    ['you', 'restore'].includes(markOf(version.cause)),
  ).length,
})
