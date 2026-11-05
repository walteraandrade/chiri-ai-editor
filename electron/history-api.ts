import type { Unsaved } from '../src/document/unsaved'
import type { MarkSavedInput, RecordInput } from '../src/history/store'
import type { VersionList } from '../src/history/types'

export const HISTORY_CHANNELS = {
  list: 'history:list',
  text: 'history:text',
  record: 'history:record',
  markSaved: 'history:mark-saved',
  unsavedLoad: 'unsaved:load',
  unsavedSave: 'unsaved:save',
  unsavedClear: 'unsaved:clear',
} as const

export type HistoryApi = {
  readonly historyList: (key: string) => Promise<VersionList>
  readonly historyText: (key: string, id: number) => Promise<string | null>
  readonly historyRecord: (key: string, input: RecordInput) => Promise<void>
  readonly historyMarkSaved: (
    key: string,
    input: MarkSavedInput,
  ) => Promise<void>
  readonly unsavedLoad: (key: string) => Promise<Unsaved | null>
  readonly unsavedSave: (key: string, unsaved: Unsaved) => Promise<void>
  readonly unsavedClear: (key: string) => Promise<void>
}
