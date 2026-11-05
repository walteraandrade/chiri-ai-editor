import { type ChiriApi, FILE_NOT_FOUND_REASON } from '../../electron/api'
import type { FileSession } from '../document/file-session'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { restoreUnsaved } from '../document/unsaved'
import { createUnsavedKeeper } from '../document/unsaved-keeper'
import { createElectronHistoryStore } from '../history/electron-store'
import { createSwitchableHistory } from '../history/hub'
import { createDocumentHistory } from '../history/session'
import { createElectronExternal } from './electron-external'
import { createElectronFiles } from './electron-files'
import { createElectronLaunches } from './electron-launches'
import { createElectronLibrary } from './electron-library'
import {
  clearLastFile,
  getRemovableStorage,
  loadLastFile,
  type RemovableStorage,
  saveLastFile,
} from './electron-storage'
import { createElectronUnsavedStore } from './electron-unsaved'
import type {
  DocumentFiles,
  ExternalKit,
  LaunchKit,
  LibraryKit,
  PlatformKit,
  PlatformKitFactory,
  StartFile,
  UnsavedStore,
} from './kit'
import { flushWhenPageHides } from './page-hide'
import { createProblems } from './problems'

const UNSAVED_DELAY_MS = 400
const HISTORY_IDLE_MS = 30_000
export const SCRATCH_KEY = 'scratch:document'

type ElectronKitDeps = {
  readonly api: Pick<
    ChiriApi,
    | 'historyList'
    | 'historyText'
    | 'historyRecord'
    | 'historyMarkSaved'
    | 'unsavedLoad'
    | 'unsavedSave'
    | 'unsavedClear'
  >
  readonly storage: RemovableStorage | null
  readonly files: DocumentFiles<string>
  readonly library: LibraryKit<string>
  readonly external: ExternalKit<string>
  readonly launches: LaunchKit<string>
  readonly preferencesRequests: (listener: () => void) => () => void
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

const SCRATCH_SESSION: FileSession<string> = {
  name: 'Untitled',
  ref: SCRATCH_KEY,
  savedText: '',
  dirty: true,
}

const nameOf = (path: string): string => path.split('/').at(-1) ?? path

const withReason = (text: string, reason: string | undefined): string =>
  reason === undefined ? text : `${text}: ${reason}`

const historyKeyOf = (ref: string | null): string => ref ?? SCRATCH_KEY

const reopen = async (
  files: DocumentFiles<string>,
  store: UnsavedStore<string>,
  path: string,
  failureText = 'Could not reopen',
): Promise<Reopened> => {
  const failure = (reason?: string): Reopened => ({
    ...NOTHING_TO_REOPEN,
    notice: withReason(`${failureText} ${nameOf(path)}`, reason),
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
  api,
  storage,
  files,
  library,
  external,
  launches,
  preferencesRequests,
  now,
  hasApiKey,
  onHide,
}: ElectronKitDeps): Promise<PlatformKit<string>> => {
  const problems = createProblems()
  const unsaved = createElectronUnsavedStore(api, {
    failed: (error) => {
      console.error('Unsaved text write failed', error)
      problems.failed('unsaved')
    },
    worked: () => problems.worked('unsaved'),
  })
  const launched = await launches.take()
  const fromLaunch =
    launched === null
      ? NOTHING_TO_REOPEN
      : await reopen(files, unsaved, launched, 'Could not open')
  const launchedRef = fromLaunch.start?.ref ?? null
  if (launchedRef !== null) saveLastFile(storage, launchedRef)
  const lastFile = launchedRef ?? loadLastFile(storage)
  const reopened =
    launchedRef !== null
      ? fromLaunch
      : lastFile === null
        ? NOTHING_TO_REOPEN
        : await reopen(files, unsaved, lastFile)
  const startNotice = fromLaunch.notice ?? reopened.notice
  const initialDoc =
    reopened.text ?? (await unsaved.load(SCRATCH_KEY))?.text ?? SAMPLE_DOCUMENT
  if (reopened.gone && lastFile !== null)
    await forgetMissing(unsaved, storage, lastFile, initialDoc)
  const startRef = reopened.start?.ref ?? null
  const historyStore = createElectronHistoryStore(api)
  await historyStore.record(historyKeyOf(startRef), {
    at: now(),
    cause: { kind: 'edited' },
    text: initialDoc,
  })
  const history = createSwitchableHistory<string>({
    keyOf: historyKeyOf,
    create: (key, initial) =>
      createDocumentHistory({
        store: historyStore,
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
    first: {
      ref: startRef,
      initial: await historyStore.list(historyKeyOf(startRef)),
    },
  })
  const keeper = createUnsavedKeeper({
    store: unsaved,
    delayMs: UNSAVED_DELAY_MS,
  })
  onHide(() => {
    keeper.flush()
    history.flush()
  })
  let remembered = reopened.gone ? null : (reopened.start?.ref ?? lastFile)
  return {
    files,
    unsavedText: {
      initial: initialDoc,
      untitledBaseline: SAMPLE_DOCUMENT,
      changed: (text, file) => {
        keeper.track(text, SCRATCH_SESSION)
        keeper.track(text, file)
        if (file?.ref != null && file.ref !== remembered) {
          remembered = file.ref
          saveLastFile(storage, file.ref)
        }
      },
      offered: async (path) => {
        keeper.flush()
        return unsaved.load(path)
      },
      discard: keeper.discard,
    },
    start: reopened.start,
    notice: startNotice,
    history,
    keyStatus: { present: hasApiKey },
    problems,
    library,
    external,
    launches,
    preferencesRequests,
  }
}

const chiriApi = (): ChiriApi => {
  if (window.chiri === undefined)
    throw new Error('The Electron preload API is missing')
  return window.chiri
}

export const createElectronKitFactory =
  (getDeps: () => ElectronKitDeps): PlatformKitFactory<string> =>
  () =>
    createElectronKit(getDeps())

export const browserElectronKit: PlatformKitFactory<string> =
  createElectronKitFactory(() => {
    const api = chiriApi()
    return {
      api,
      storage: getRemovableStorage(),
      files: createElectronFiles(api),
      library: createElectronLibrary(api),
      external: createElectronExternal(api),
      launches: createElectronLaunches(api),
      preferencesRequests: api.onPreferencesRequest,
      now: Date.now,
      hasApiKey: __HAS_OPENROUTER_KEY__,
      onHide: flushWhenPageHides,
    }
  })
