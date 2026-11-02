import { createAutosave } from '../document/autosave'
import {
  browserFileFallback,
  browserFileHost,
  createFileInput,
} from '../document/browser-files'
import type { MarkdownFileHandle } from '../document/file-access'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import {
  getLocalStorage,
  loadDocument,
  type StorageLike,
  saveDocument,
} from '../document/storage'
import { createWebFiles } from '../document/web-files'
import { createSwitchableHistory } from '../history/hub'
import { createLocalHistoryStore } from '../history/local-store'
import { createDocumentHistory } from '../history/session'
import type { DocumentFiles, PlatformKit, PlatformKitFactory } from './kit'
import { flushWhenPageHides } from './page-hide'
import { createProblems } from './problems'

const AUTOSAVE_DELAY_MS = 400
const HISTORY_IDLE_MS = 30_000
const HISTORY_KEY = 'document'

type WebKitDeps = {
  readonly storage: StorageLike | null
  readonly files: DocumentFiles<MarkdownFileHandle>
  readonly now: () => number
  readonly hasApiKey: boolean
  readonly onHide: (flush: () => void) => void
}

export const createWebKit = async ({
  storage,
  files,
  now,
  hasApiKey,
  onHide,
}: WebKitDeps): Promise<PlatformKit<MarkdownFileHandle>> => {
  const initialDoc = loadDocument(storage, SAMPLE_DOCUMENT)
  const store = createLocalHistoryStore(storage)
  await store.record(HISTORY_KEY, {
    at: now(),
    cause: { kind: 'edited' },
    text: initialDoc,
  })
  const problems = createProblems()
  const history = createSwitchableHistory<MarkdownFileHandle>({
    keyOf: () => HISTORY_KEY,
    create: (key, initial) =>
      createDocumentHistory({
        store,
        key,
        initial,
        now,
        idleMs: HISTORY_IDLE_MS,
        onError: (error) => {
          console.error('History write failed', error)
          problems.failed('history')
        },
        onWritten: () => problems.worked('history'),
      }),
    first: { ref: null, initial: await store.list(HISTORY_KEY) },
  })
  const autosave = createAutosave({
    save: (text) => store.makeRoomFor(() => saveDocument(storage, text)),
    delayMs: AUTOSAVE_DELAY_MS,
  })
  onHide(() => {
    autosave.flush()
    history.flush()
  })
  return {
    files,
    unsavedText: {
      initial: initialDoc,
      changed: (text) => autosave.schedule(text),
      offered: async () => null,
    },
    start: null,
    notice: null,
    history,
    keyStatus: { present: hasApiKey },
    problems,
  }
}

export const createWebKitFactory =
  (getDeps: () => WebKitDeps): PlatformKitFactory<MarkdownFileHandle> =>
  async () =>
    createWebKit(getDeps())

const browserFiles = (): DocumentFiles<MarkdownFileHandle> => {
  let input: HTMLInputElement | null = null
  return createWebFiles({
    host: browserFileHost,
    fallback: browserFileFallback(() => {
      input ??= createFileInput()
      return input
    }),
  })
}

export const browserWebKit: PlatformKitFactory<MarkdownFileHandle> =
  createWebKitFactory(() => ({
    storage: getLocalStorage(),
    files: browserFiles(),
    now: Date.now,
    hasApiKey: __HAS_OPENROUTER_KEY__,
    onHide: flushWhenPageHides,
  }))
