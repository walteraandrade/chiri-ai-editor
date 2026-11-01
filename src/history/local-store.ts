import type { StorageLike } from '../document/storage'
import { markSaved, recordVersion } from './history'
import { loadHistory, makeRoomFor, saveHistory } from './storage'
import type { HistoryStore } from './store'
import { summarize } from './summary'
import type { History } from './types'

export type LocalHistoryStore = HistoryStore & {
  readonly makeRoomFor: (write: () => boolean) => boolean
}

export const createLocalHistoryStore = (
  storage: StorageLike | null,
): LocalHistoryStore => {
  let history: History = loadHistory(storage) ?? []

  const update = (next: History): void => {
    if (next === history) return
    history = next
    saveHistory(storage, history)
  }

  return {
    list: async () =>
      history.map((version, index) => summarize(version, history[index - 1])),
    text: async (_key, id) =>
      history.find((version) => version.id === id)?.text ?? null,
    record: async (_key, input) => update(recordVersion(history, input)),
    markSaved: async (_key, input) => update(markSaved(history, input)),
    makeRoomFor: (write) => makeRoomFor(storage, history, write),
  }
}
