import { createHistoryRecorder, type HistoryRecorder } from './recorder'
import {
  applyWrite,
  type HistoryKey,
  type HistoryStore,
  type HistoryWrite,
} from './store'
import type { VersionId, VersionList } from './types'

const TEXT_CACHE_SIZE = 200

type DocumentHistoryOptions = {
  readonly store: HistoryStore
  readonly key: HistoryKey
  readonly initial?: VersionList
  readonly now: () => number
  readonly idleMs: number
  readonly onError: (error: unknown) => void
  readonly onWritten?: () => void
  readonly cacheSize?: number
}

export type DocumentHistory = HistoryRecorder & {
  readonly snapshot: () => VersionList
  readonly subscribe: (listener: () => void) => () => void
  readonly text: (id: VersionId) => Promise<string | null>
  readonly settled: () => Promise<void>
}

const sameVersions = (left: VersionList, right: VersionList): boolean =>
  left.length === right.length &&
  left.every((version, index) => {
    const other = right[index]
    return other?.id === version.id && other.saved === version.saved
  })

export const createDocumentHistory = ({
  store,
  key,
  initial,
  now,
  idleMs,
  onError,
  onWritten = () => undefined,
  cacheSize = TEXT_CACHE_SIZE,
}: DocumentHistoryOptions): DocumentHistory => {
  let versions = initial ?? []
  let listing: Promise<void> | null = null
  let stale = false
  const sending = new Set<Promise<void>>()
  const listeners = new Set<() => void>()
  const texts = new Map<VersionId, string>()
  const loading = new Map<VersionId, Promise<string | null>>()

  const refresh = async (): Promise<void> => {
    try {
      const listed = await store.list(key)
      if (sameVersions(versions, listed)) return
      versions = listed
      for (const listener of listeners) listener()
    } catch (error) {
      onError(error)
    }
  }

  const listAgain = async (): Promise<void> => {
    do {
      stale = false
      await refresh()
    } while (stale)
    listing = null
  }

  const requestList = (): void => {
    stale = true
    if (listing === null) listing = listAgain()
  }

  const start = (write: HistoryWrite): Promise<void> => {
    try {
      return applyWrite(store, key, write)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  const send = (write: HistoryWrite): void => {
    const sent: Promise<void> = start(write)
      .then(onWritten, onError)
      .finally(() => {
        sending.delete(sent)
        if (sending.size === 0) requestList()
      })
    sending.add(sent)
  }

  const recorder = createHistoryRecorder({ emit: send, now, idleMs })

  const remember = (id: VersionId, text: string): void => {
    texts.set(id, text)
    const oldest = texts.keys().next()
    if (texts.size > cacheSize && !oldest.done) texts.delete(oldest.value)
  }

  const load = (id: VersionId): Promise<string | null> =>
    store.text(key, id).then((text) => {
      if (text !== null) remember(id, text)
      return text
    })

  const settled = async (): Promise<void> => {
    while (sending.size > 0 || listing !== null)
      await Promise.all([...sending, listing])
  }

  if (initial === undefined) requestList()

  return {
    ...recorder,
    snapshot: () => versions,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    text: (id) => {
      const known = texts.get(id)
      if (known !== undefined) return Promise.resolve(known)
      const inFlight = loading.get(id)
      if (inFlight !== undefined) return inFlight
      const started = load(id).finally(() => loading.delete(id))
      loading.set(id, started)
      return started
    },
    settled,
  }
}
