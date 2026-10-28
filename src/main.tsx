import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createAutosave } from './document/autosave'
import { SAMPLE_DOCUMENT } from './document/sample-document'
import { getLocalStorage, loadDocument, saveDocument } from './document/storage'
import { App } from './ui/App'

const AUTOSAVE_DELAY_MS = 400

const storage = getLocalStorage()
const autosave = createAutosave({
  save: (text) => saveDocument(storage, text),
  delayMs: AUTOSAVE_DELAY_MS,
})

window.addEventListener('pagehide', autosave.flush)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave.flush()
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App
      initialDoc={loadDocument(storage, SAMPLE_DOCUMENT)}
      hasApiKey={__HAS_OPENROUTER_KEY__}
      onDocumentChange={autosave.schedule}
    />
  </StrictMode>,
)
