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
} from '../document/storage'
import { createWebFiles } from '../document/web-files'
import type { DocumentFiles, PlatformKit, PlatformKitFactory } from './kit'
import { createLocalState } from './local-state'

type WebKitDeps = {
  readonly storage: StorageLike | null
  readonly files: DocumentFiles<MarkdownFileHandle>
  readonly now: () => number
  readonly hasApiKey: boolean
  readonly onHide: (flush: () => void) => void
}

export const createWebKit = ({
  storage,
  files,
  now,
  hasApiKey,
  onHide,
}: WebKitDeps): PlatformKit<MarkdownFileHandle> => {
  const initialDoc = loadDocument(storage, SAMPLE_DOCUMENT)
  const { history, autosave, flush } = createLocalState({
    storage,
    now,
    initialDoc,
  })
  onHide(flush)
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
  }
}

const flushWhenPageHides = (flush: () => void): void => {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
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
