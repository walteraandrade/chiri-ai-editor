import type { HistoryApi } from '../../electron/history-api'
import type { HistoryStore } from './store'

export type HistoryBridge = Pick<
  HistoryApi,
  'historyList' | 'historyText' | 'historyRecord' | 'historyMarkSaved'
>

export const createElectronHistoryStore = (
  bridge: HistoryBridge,
): HistoryStore => ({
  list: (key) => bridge.historyList(key),
  text: (key, id) => bridge.historyText(key, id),
  record: (key, input) => bridge.historyRecord(key, input),
  markSaved: (key, input) => bridge.historyMarkSaved(key, input),
})
