import { type ChiriApi, FILE_NOT_FOUND_REASON } from '../../electron/api'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { loadDocument } from '../document/storage'
import { restoreUnsaved } from '../document/unsaved'
import { createUnsavedKeeper } from '../document/unsaved-keeper'
import { createElectronFiles } from './electron-files'
import {
  clearLastFile,
  createLocalUnsavedStore,
  getRemovableStorage,
  loadLastFile,
  type RemovableStorage,
  saveLastFile,
} from './electron-storage'
import type {
  DocumentFiles,
  PlatformKit,
  PlatformKitFactory,
  StartFile,
  UnsavedStore,
} from './kit'
import { createLocalState } from './local-state'

const UNSAVED_DELAY_MS = 400

type ElectronKitDeps = {
  readonly storage: RemovableStorage | null
  readonly files: DocumentFiles<string>
  readonly flushStorage: () => Promise<void>
  readonly now: () => number
  readonly hasApiKey: boolean
  readonly onHide: (flush: () => void) => void
}

type Reopened = {
  readonly text: string | null
  readonly start: StartFile<string> | null
  readonly notice: string | null
  readonly gone: boolean
}

const NOTHING_TO_REOPEN: Reopened = {
  text: null,
  start: null,
  notice: null,
  gone: false,
}

const nameOf = (path: string): string => path.split('/').at(-1) ?? path

const withReason = (text: string, reason: string | undefined): string =>
  reason === undefined ? text : `${text}: ${reason}`

const reopen = async (
  files: DocumentFiles<string>,
  store: UnsavedStore<string>,
  path: string,
): Promise<Reopened> => {
  const failure = (reason?: string): Reopened => ({
    ...NOTHING_TO_REOPEN,
    notice: withReason(`Could not reopen ${nameOf(path)}`, reason),
    gone: reason === FILE_NOT_FOUND_REASON,
  })
  try {
    const result = await files.read(path)
    if (result.kind === 'cancelled') return NOTHING_TO_REOPEN
    if (result.kind === 'failed') return failure(result.reason)
    const { name, text, ref } = result.file
    const arrival = restoreUnsaved(text, await store.load(path))
    return {
      text: arrival.text,
      start: {
        name,
        ref,
        savedText: arrival.savedText,
        diskChanged: arrival.diskChanged,
      },
      notice: arrival.restored ? `Restored unsaved changes to ${name}` : null,
      gone: false,
    }
  } catch {
    return failure()
  }
}

const forgetMissing = async (
  store: UnsavedStore<string>,
  storage: RemovableStorage | null,
  path: string,
  document: string,
): Promise<void> => {
  clearLastFile(storage)
  const unsaved = await store.load(path)
  if (unsaved === null || unsaved.text === document) store.drop(path)
}

export const createElectronKit = async ({
  storage,
  files,
  flushStorage,
  now,
  hasApiKey,
  onHide,
}: ElectronKitDeps): Promise<PlatformKit<string>> => {
  const toDisk = (): void => {
    flushStorage().catch(() => undefined)
  }
  const store = createLocalUnsavedStore(storage, toDisk)
  const lastFile = loadLastFile(storage)
  const reopened =
    lastFile === null ? NOTHING_TO_REOPEN : await reopen(files, store, lastFile)
  const initialDoc = reopened.text ?? loadDocument(storage, SAMPLE_DOCUMENT)
  if (reopened.gone && lastFile !== null)
    await forgetMissing(store, storage, lastFile, initialDoc)
  const { history, autosave, flush } = createLocalState({
    storage,
    now,
    initialDoc,
  })
  const keeper = createUnsavedKeeper({ store, delayMs: UNSAVED_DELAY_MS })
  onHide(() => {
    flush()
    keeper.flush()
  })
  let remembered = reopened.gone ? null : (reopened.start?.ref ?? lastFile)
  return {
    files,
    unsavedText: {
      initial: initialDoc,
      changed: (text, file) => {
        autosave.schedule(text)
        keeper.track(text, file)
        if (file?.ref != null && file.ref !== remembered) {
          remembered = file.ref
          saveLastFile(storage, file.ref)
          toDisk()
        }
      },
      offered: async (path) => {
        keeper.flush()
        return store.load(path)
      },
    },
    start: reopened.start,
    notice: reopened.notice,
    history,
    keyStatus: { present: hasApiKey },
  }
}

const chiriApi = (): ChiriApi => {
  if (window.chiri === undefined)
    throw new Error('The Electron preload API is missing')
  return window.chiri
}

const flushWhenPageHides = (flush: () => void): void => {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

export const createElectronKitFactory =
  (getDeps: () => ElectronKitDeps): PlatformKitFactory<string> =>
  () =>
    createElectronKit(getDeps())

export const browserElectronKit: PlatformKitFactory<string> =
  createElectronKitFactory(() => {
    const api = chiriApi()
    return {
      storage: getRemovableStorage(),
      files: createElectronFiles(api),
      flushStorage: api.flushStorage,
      now: Date.now,
      hasApiKey: __HAS_OPENROUTER_KEY__,
      onHide: flushWhenPageHides,
    }
  })
