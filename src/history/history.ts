import type { History, Version, VersionCause, VersionId } from './types'

export const MAX_VERSIONS = 50

type VersionInput = {
  readonly text: string
  readonly cause: VersionCause
  readonly at: number
}

export const startHistory = (text: string, at: number): History => [
  { id: 1, at, cause: { kind: 'started' }, text },
]

export const recordVersion = (
  history: History,
  { text, cause, at }: VersionInput,
): History => {
  const last = history.at(-1)
  if (last === undefined) return startHistory(text, at)
  if (last.text === text) return history
  return [...history, { id: last.id + 1, at, cause, text }].slice(-MAX_VERSIONS)
}

export const markSaved = (
  history: History,
  {
    text,
    name,
    at,
  }: { readonly text: string; readonly name: string; readonly at: number },
): History => {
  const recorded = recordVersion(history, {
    text,
    cause: { kind: 'edited' },
    at,
  })
  const last = recorded.at(-1)
  return last === undefined
    ? recorded
    : [...recorded.slice(0, -1), { ...last, saved: name }]
}

export const resumeHistory = (
  stored: History | null,
  text: string,
  at: number,
): History =>
  stored === null || stored.length === 0
    ? startHistory(text, at)
    : recordVersion(stored, { text, cause: { kind: 'edited' }, at })

export const previousVersion = (
  history: History,
  id: VersionId,
): Version | undefined => {
  const index = history.findIndex((version) => version.id === id)
  return index > 0 ? history[index - 1] : undefined
}
