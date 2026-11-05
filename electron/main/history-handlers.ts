import type { Unsaved } from '../../src/document/unsaved'
import { isCause } from '../../src/history/cause'
import type { MarkSavedInput, RecordInput } from '../../src/history/store'
import type { VersionId, VersionList } from '../../src/history/types'
import type { HistoryDb } from './history-db'

const MAX_KEY_LENGTH = 4096
const MAX_NAME_LENGTH = 4096
const MAX_TEXT_LENGTH = 16 * 1024 * 1024

export type HistoryHandlers = {
  readonly list: (key: unknown) => VersionList
  readonly text: (key: unknown, id: unknown) => string | null
  readonly record: (key: unknown, input: unknown) => void
  readonly markSaved: (key: unknown, input: unknown) => void
  readonly loadUnsaved: (key: unknown) => Unsaved | null
  readonly saveUnsaved: (key: unknown, unsaved: unknown) => void
  readonly clearUnsaved: (key: unknown) => void
}

type Fields = Readonly<Record<string, unknown>>

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_TEXT_LENGTH

const isLabel = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_NAME_LENGTH

const parseKey = (value: unknown): string => {
  if (!isLabel(value) || value.length > MAX_KEY_LENGTH || value.includes('\0'))
    throw new Error('Invalid History key')
  return value
}

const parseId = (value: unknown): VersionId => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('Invalid Version id')
  return value
}

const parseUnsaved = (value: unknown): Unsaved => {
  if (!isFields(value) || !isText(value.text) || !isText(value.base))
    throw new Error('Invalid unsaved text')
  return { text: value.text, base: value.base }
}

const parseRecord = (value: unknown): RecordInput => {
  if (
    !isFields(value) ||
    !isTime(value.at) ||
    !isCause(value.cause) ||
    !isText(value.text)
  )
    throw new Error('Invalid record input')
  return { at: value.at, cause: value.cause, text: value.text }
}

const parseMarkSaved = (value: unknown): MarkSavedInput => {
  if (
    !isFields(value) ||
    !isText(value.text) ||
    !isLabel(value.name) ||
    !isTime(value.at)
  )
    throw new Error('Invalid saved input')
  return { text: value.text, name: value.name, at: value.at }
}

export const createHistoryHandlers = (
  db: HistoryDb,
  now: () => number,
): HistoryHandlers => {
  const thinned = new Set<string>()
  return {
    list: (key) => {
      const path = parseKey(key)
      if (!thinned.has(path)) {
        thinned.add(path)
        db.thin(path, now())
      }
      return db.list(path)
    },
    text: (key, id) => db.text(parseKey(key), parseId(id)),
    record: (key, input) => db.record(parseKey(key), parseRecord(input)),
    markSaved: (key, input) =>
      db.markSaved(parseKey(key), parseMarkSaved(input)),
    loadUnsaved: (key) => db.loadUnsaved(parseKey(key)),
    saveUnsaved: (key, unsaved) =>
      db.saveUnsaved(parseKey(key), parseUnsaved(unsaved), now()),
    clearUnsaved: (key) => db.clearUnsaved(parseKey(key)),
  }
}
