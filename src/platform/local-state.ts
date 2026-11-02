import { type Autosave, createAutosave } from '../document/autosave'
import { type StorageLike, saveDocument } from '../document/storage'
import { resumeHistory } from '../history/history'
import {
  createHistoryRecorder,
  type HistoryRecorder,
} from '../history/recorder'
import { loadHistory, makeRoomFor, saveHistory } from '../history/storage'

const AUTOSAVE_DELAY_MS = 400
const HISTORY_IDLE_MS = 30_000

type LocalStateDeps = {
  readonly storage: StorageLike | null
  readonly now: () => number
  readonly initialDoc: string
}

export type LocalState = {
  readonly history: HistoryRecorder
  readonly autosave: Autosave
  readonly flush: () => void
}

export const createLocalState = ({
  storage,
  now,
  initialDoc,
}: LocalStateDeps): LocalState => {
  const storedHistory = loadHistory(storage)
  const initialHistory = resumeHistory(storedHistory, initialDoc, now())
  if (initialHistory !== storedHistory) saveHistory(storage, initialHistory)
  const history = createHistoryRecorder({
    initial: initialHistory,
    persist: (versions) => saveHistory(storage, versions),
    now,
    idleMs: HISTORY_IDLE_MS,
  })
  const autosave = createAutosave({
    save: (text) =>
      makeRoomFor(storage, history.snapshot(), () =>
        saveDocument(storage, text),
      ),
    delayMs: AUTOSAVE_DELAY_MS,
  })
  return {
    history,
    autosave,
    flush: () => {
      autosave.flush()
      history.flush()
    },
  }
}
