import type { StorageLike } from '../document/storage'
import type { AcceptedChange, History, Version, VersionCause } from './types'

export const HISTORY_STORAGE_KEY = 'chiri.history'

const FALLBACK_SIZES = [10, 1] as const

type Fields = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null

const isString = (value: unknown): value is string => typeof value === 'string'

const isChange = (value: unknown): value is AcceptedChange =>
  isRecord(value) &&
  (value.origin === 'ask' || value.origin === 'review') &&
  isString(value.instruction) &&
  isString(value.rationale)

const isCause = (value: unknown): value is VersionCause => {
  if (!isRecord(value)) return false
  switch (value.kind) {
    case 'started':
    case 'edited':
      return true
    case 'accepted':
      return Array.isArray(value.changes) && value.changes.every(isChange)
    case 'opened':
      return isString(value.name)
    case 'restored':
      return Number.isInteger(value.from)
    default:
      return false
  }
}

const isVersion = (value: unknown): value is Version =>
  isRecord(value) &&
  Number.isInteger(value.id) &&
  typeof value.at === 'number' &&
  isCause(value.cause) &&
  isString(value.text) &&
  (value.saved === undefined || isString(value.saved))

export const loadHistory = (storage: StorageLike | null): History | null => {
  try {
    const raw = storage?.getItem(HISTORY_STORAGE_KEY)
    if (raw === null || raw === undefined) return null
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) &&
      Array.isArray(parsed.versions) &&
      parsed.versions.every(isVersion)
      ? parsed.versions
      : null
  } catch {
    return null
  }
}

const tryStore = (storage: StorageLike, history: History): boolean => {
  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ versions: history }))
    return true
  } catch {
    return false
  }
}

export const makeRoomFor = (
  storage: StorageLike | null,
  history: History,
  write: () => boolean,
): boolean =>
  write() ||
  (storage !== null &&
    [...FALLBACK_SIZES, 0].some(
      (size) =>
        tryStore(storage, size === 0 ? [] : history.slice(-size)) && write(),
    ))

export const saveHistory = (
  storage: StorageLike | null,
  history: History,
): boolean =>
  storage !== null &&
  [history, ...FALLBACK_SIZES.map((size) => history.slice(-size))].some(
    (candidate) => tryStore(storage, candidate),
  )
