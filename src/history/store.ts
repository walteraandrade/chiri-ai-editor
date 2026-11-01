import type { VersionCause, VersionId, VersionList } from './types'

export type HistoryKey = string

export type RecordInput = {
  readonly at: number
  readonly cause: VersionCause
  readonly text: string
}

export type MarkSavedInput = {
  readonly text: string
  readonly name: string
  readonly at: number
}

export type HistoryWrite =
  | ({ readonly type: 'version-recorded' } & RecordInput)
  | ({ readonly type: 'version-marked-saved' } & MarkSavedInput)

export type HistoryStore = {
  readonly list: (key: HistoryKey) => Promise<VersionList>
  readonly text: (key: HistoryKey, id: VersionId) => Promise<string | null>
  readonly record: (key: HistoryKey, input: RecordInput) => Promise<void>
  readonly markSaved: (key: HistoryKey, input: MarkSavedInput) => Promise<void>
}

export const applyWrite = (
  store: HistoryStore,
  key: HistoryKey,
  write: HistoryWrite,
): Promise<void> =>
  write.type === 'version-recorded'
    ? store.record(key, { at: write.at, cause: write.cause, text: write.text })
    : store.markSaved(key, {
        text: write.text,
        name: write.name,
        at: write.at,
      })
