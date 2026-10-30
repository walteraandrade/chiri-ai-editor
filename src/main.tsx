import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createAutosave } from './document/autosave'
import { SAMPLE_DOCUMENT } from './document/sample-document'
import { getLocalStorage, loadDocument, saveDocument } from './document/storage'
import { resumeHistory } from './history/history'
import { createHistoryRecorder } from './history/recorder'
import { loadHistory, makeRoomFor, saveHistory } from './history/storage'
import { App } from './ui/App'

const AUTOSAVE_DELAY_MS = 400
const HISTORY_IDLE_MS = 30_000

const storage = getLocalStorage()
const initialDoc = loadDocument(storage, SAMPLE_DOCUMENT)
const storedHistory = loadHistory(storage)
const initialHistory = resumeHistory(storedHistory, initialDoc, Date.now())
if (initialHistory !== storedHistory) saveHistory(storage, initialHistory)
const history = createHistoryRecorder({
  initial: initialHistory,
  persist: (versions) => saveHistory(storage, versions),
  now: Date.now,
  idleMs: HISTORY_IDLE_MS,
})

const autosave = createAutosave({
  save: (text) =>
    makeRoomFor(storage, history.snapshot(), () => saveDocument(storage, text)),
  delayMs: AUTOSAVE_DELAY_MS,
})

const flushAll = (): void => {
  autosave.flush()
  history.flush()
}

window.addEventListener('pagehide', flushAll)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushAll()
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App
      initialDoc={initialDoc}
      hasApiKey={__HAS_OPENROUTER_KEY__}
      onDocumentChange={autosave.schedule}
      history={history}
    />
  </StrictMode>,
)
