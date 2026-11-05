import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { gunzipSync, gzipSync } from 'node:zlib'
import { countWords } from '../../src/diff/count-words'
import type { Unsaved } from '../../src/document/unsaved'
import { isCause } from '../../src/history/cause'
import type { MarkSavedInput, RecordInput } from '../../src/history/store'
import { idsToThin } from '../../src/history/thin'
import type {
  VersionCause,
  VersionId,
  VersionList,
  VersionSummary,
} from '../../src/history/types'
import { wordDelta } from '../../src/history/word-delta'
import { inTransaction } from './transaction'

const SCHEMA_VERSION = 1
const BUSY_TIMEOUT_MS = 5000

const SCHEMA = `
  create table files (
    id integer primary key,
    path text unique not null
  );
  create table blobs (
    hash text primary key,
    body blob not null
  );
  create table versions (
    id integer primary key,
    file_id integer not null references files(id),
    at integer not null,
    cause text not null,
    blob_hash text not null references blobs(hash),
    words integer not null,
    words_added integer not null,
    words_removed integer not null,
    saved text
  );
  create index versions_by_file on versions(file_id, at);
  create table drafts (
    file_id integer primary key references files(id),
    text text not null,
    base_hash text not null references blobs(hash),
    at integer not null
  );
`

export type HistoryDb = {
  readonly list: (path: string) => VersionList
  readonly text: (path: string, id: VersionId) => string | null
  readonly record: (path: string, input: RecordInput) => void
  readonly markSaved: (path: string, input: MarkSavedInput) => void
  readonly loadUnsaved: (path: string) => Unsaved | null
  readonly saveUnsaved: (path: string, unsaved: Unsaved, at: number) => void
  readonly clearUnsaved: (path: string) => void
  readonly thin: (path: string, now: number) => number
  readonly close: () => void
}

const STARTED: VersionCause = { kind: 'started' }

type LatestVersion = {
  readonly hash: string
  readonly text: () => string
}

const numberOf = (value: unknown): number => {
  if (typeof value !== 'number') throw new Error('Unexpected History row')
  return value
}

const stringOf = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Unexpected History row')
  return value
}

const bytesOf = (value: unknown): Uint8Array => {
  if (!(value instanceof Uint8Array)) throw new Error('Unexpected History row')
  return value
}

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')

const causeOf = (json: unknown): VersionCause => {
  const parsed: unknown = JSON.parse(stringOf(json))
  if (!isCause(parsed)) throw new Error('Unexpected History cause')
  return parsed
}

const summaryOf = (row: Record<string, unknown>): VersionSummary => ({
  id: numberOf(row.id),
  at: numberOf(row.at),
  cause: causeOf(row.cause),
  words: numberOf(row.words),
  wordsAdded: numberOf(row.words_added),
  wordsRemoved: numberOf(row.words_removed),
  ...(row.saved === null ? {} : { saved: stringOf(row.saved) }),
})

type SchemaDb = Pick<DatabaseSync, 'exec' | 'prepare'>

export const prepareSchema = (db: SchemaDb): void => {
  db.exec(`pragma busy_timeout = ${BUSY_TIMEOUT_MS}`)
  db.exec('pragma journal_mode = wal')
  db.exec('pragma synchronous = normal')
  inTransaction(db, () => {
    const version = numberOf(
      db.prepare('pragma user_version').get()?.user_version,
    )
    if (version > SCHEMA_VERSION)
      throw new Error(`Unsupported History schema version ${version}`)
    if (version === 0) {
      db.exec(SCHEMA)
      db.exec(`pragma user_version = ${SCHEMA_VERSION}`)
    }
  })
}

export const openHistoryDb = (file: string): HistoryDb => {
  const db = new DatabaseSync(file)
  let open = true
  try {
    prepareSchema(db)
  } catch (error) {
    db.close()
    throw error
  }

  const statements = {
    ensureFile: db.prepare(
      'insert into files (path) values (?) on conflict (path) do nothing',
    ),
    fileId: db.prepare('select id from files where path = ?'),
    latest: db.prepare(
      'select v.blob_hash, b.body from versions v join blobs b on b.hash = v.blob_hash where v.file_id = ? order by v.id desc limit 1',
    ),
    holding: db.prepare(
      'select id from versions where file_id = ? and blob_hash = ? order by id desc limit 1',
    ),
    insertBlob: db.prepare(
      'insert or ignore into blobs (hash, body) values (?, ?)',
    ),
    insertVersion: db.prepare(
      'insert into versions (file_id, at, cause, blob_hash, words, words_added, words_removed) values (?, ?, ?, ?, ?, ?, ?)',
    ),
    mark: db.prepare('update versions set saved = ? where id = ?'),
    list: db.prepare(
      'select v.id, v.at, v.cause, v.words, v.words_added, v.words_removed, v.saved from versions v join files f on f.id = v.file_id where f.path = ? order by v.id',
    ),
    body: db.prepare(
      'select b.body from versions v join files f on f.id = v.file_id join blobs b on b.hash = v.blob_hash where f.path = ? and v.id = ?',
    ),
    loadUnsaved: db.prepare(
      'select d.text, b.body from drafts d join files f on f.id = d.file_id join blobs b on b.hash = d.base_hash where f.path = ?',
    ),
    saveUnsaved: db.prepare(
      'insert into drafts (file_id, text, base_hash, at) values (?, ?, ?, ?) on conflict (file_id) do update set text = excluded.text, base_hash = excluded.base_hash, at = excluded.at',
    ),
    clearUnsaved: db.prepare(
      'delete from drafts where file_id in (select id from files where path = ?)',
    ),
    thinList: db.prepare(
      'select v.id, v.at, v.cause, v.saved from versions v join files f on f.id = v.file_id where f.path = ? order by v.id',
    ),
    deleteVersion: db.prepare('delete from versions where id = ?'),
    dropOrphanBlobs: db.prepare(
      'delete from blobs where hash not in (select blob_hash from versions) and hash not in (select base_hash from drafts)',
    ),
  }

  const fileIdOf = (path: string): number => {
    statements.ensureFile.run(path)
    return numberOf(statements.fileId.get(path)?.id)
  }

  const latestOf = (fileId: number): LatestVersion | null => {
    const row = statements.latest.get(fileId)
    return row === undefined
      ? null
      : {
          hash: stringOf(row.blob_hash),
          text: () => gunzipSync(bytesOf(row.body)).toString('utf8'),
        }
  }

  const append = (
    fileId: number,
    { at, cause, text }: RecordInput,
    hash: string,
    body: Uint8Array,
    latest: LatestVersion | null,
  ): number => {
    const { added, removed } = wordDelta(latest?.text() ?? '', text)
    statements.insertBlob.run(hash, body)
    const { lastInsertRowid } = statements.insertVersion.run(
      fileId,
      at,
      JSON.stringify(latest === null ? STARTED : cause),
      hash,
      countWords(text),
      added,
      removed,
    )
    return Number(lastInsertRowid)
  }

  return {
    list: (path) => statements.list.all(path).map(summaryOf),
    text: (path, id) => {
      const row = statements.body.get(path, id)
      return row === undefined
        ? null
        : gunzipSync(bytesOf(row.body)).toString('utf8')
    },
    record: (path, input) => {
      const hash = sha256(input.text)
      const body = gzipSync(Buffer.from(input.text, 'utf8'))
      inTransaction(db, () => {
        const fileId = fileIdOf(path)
        const latest = latestOf(fileId)
        if (latest?.hash !== hash) append(fileId, input, hash, body, latest)
      })
    },
    markSaved: (path, { text, name, at }) => {
      const hash = sha256(text)
      const body = gzipSync(Buffer.from(text, 'utf8'))
      inTransaction(db, () => {
        const fileId = fileIdOf(path)
        const held = statements.holding.get(fileId, hash)
        const target =
          held === undefined
            ? append(
                fileId,
                { at, cause: { kind: 'edited' }, text },
                hash,
                body,
                latestOf(fileId),
              )
            : numberOf(held.id)
        statements.mark.run(name, target)
      })
    },
    loadUnsaved: (path) => {
      const row = statements.loadUnsaved.get(path)
      return row === undefined
        ? null
        : {
            text: stringOf(row.text),
            base: gunzipSync(bytesOf(row.body)).toString('utf8'),
          }
    },
    saveUnsaved: (path, { text, base }, at) => {
      const baseHash = sha256(base)
      const body = gzipSync(Buffer.from(base, 'utf8'))
      inTransaction(db, () => {
        statements.insertBlob.run(baseHash, body)
        statements.saveUnsaved.run(fileIdOf(path), text, baseHash, at)
      })
    },
    clearUnsaved: (path) => {
      statements.clearUnsaved.run(path)
    },
    thin: (path, now) => {
      const candidates = statements.thinList.all(path).map((row) => ({
        id: numberOf(row.id),
        at: numberOf(row.at),
        kind: causeOf(row.cause).kind,
        saved: row.saved !== null,
      }))
      const doomed = idsToThin(candidates, now)
      if (doomed.length === 0) return 0
      inTransaction(db, () => {
        doomed.forEach((id) => {
          statements.deleteVersion.run(id)
        })
        statements.dropOrphanBlobs.run()
      })
      return doomed.length
    },
    close: () => {
      if (!open) return
      open = false
      db.close()
    },
  }
}
