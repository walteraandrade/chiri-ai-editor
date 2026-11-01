import { createAutosave } from '../document/autosave'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import {
  getLocalStorage,
  loadDocument,
  type StorageLike,
  saveDocument,
} from '../document/storage'
import { resumeHistory } from '../history/history'
import { createHistoryRecorder } from '../history/recorder'
import { loadHistory, makeRoomFor, saveHistory } from '../history/storage'
import type { PlatformKit, PlatformKitFactory } from './kit'

const AUTOSAVE_DELAY_MS = 400
const HISTORY_IDLE_MS = 30_000

type WebKitDeps = {
  readonly storage: StorageLike | null
  readonly now: () => number
  readonly hasApiKey: boolean
  readonly onHide: (flush: () => void) => void
}

export const createWebKit = ({
  storage,
  now,
  hasApiKey,
  onHide,
}: WebKitDeps): PlatformKit => {
  const initialDoc = loadDocument(storage, SAMPLE_DOCUMENT)
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
  onHide(() => {
    autosave.flush()
    history.flush()
  })
  return {
    unsavedText: { initial: initialDoc, changed: autosave.schedule },
    history,
    keyStatus: { present: hasApiKey },
  }
}

const flushWhenPageHides = (flush: () => void): void => {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

export const createWebKitFactory =
  (getDeps: () => WebKitDeps): PlatformKitFactory =>
  async () =>
    createWebKit(getDeps())

export const browserWebKit: PlatformKitFactory = createWebKitFactory(() => ({
  storage: getLocalStorage(),
  now: Date.now,
  hasApiKey: __HAS_OPENROUTER_KEY__,
  onHide: flushWhenPageHides,
}))
