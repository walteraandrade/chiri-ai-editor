import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type HistoryDb, openHistoryDb, prepareSchema } from './history-db'

const PATH = '/skills/review/SKILL.md'

let directory = ''
let file = ''
const opened: HistoryDb[] = []

const open = (): HistoryDb => {
  const db = openHistoryDb(file)
  opened.push(db)
  return db
}

const inspect = <T>(read: (db: DatabaseSync) => T): T => {
  const db = new DatabaseSync(file)
  try {
    return read(db)
  } finally {
    db.close()
  }
}

const edit = (text: string, at = 1) => ({
  at,
  cause: { kind: 'edited' } as const,
  text,
})

describe('openHistoryDb', () => {
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chiri-history-'))
    file = join(directory, 'history.sqlite')
  })

  afterEach(() => {
    for (const db of opened.splice(0)) db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('creates the tables of ADR 0015', () => {
    open()
    const names = inspect((db) =>
      db
        .prepare(
          "select name from sqlite_master where type in ('table', 'index') and name not like 'sqlite_%' order by name",
        )
        .all()
        .map((row) => row.name),
    )
    expect(names).toEqual([
      'blobs',
      'drafts',
      'files',
      'versions',
      'versions_by_file',
    ])
  })

  it('runs in WAL mode', () => {
    open()
    const mode = inspect((db) => db.prepare('pragma journal_mode').get())
    expect(mode).toEqual({ journal_mode: 'wal' })
  })

  it('opens a database it already created', () => {
    const first = open()
    first.record(PATH, edit('kept'))
    first.close()
    const second = open()
    expect(second.list(PATH)).toHaveLength(1)
  })

  it('creates the schema once when another connection creates it first', () => {
    const slow = new DatabaseSync(file)
    let raced = false
    const spied = {
      exec: (sql: string) => {
        if (sql === 'begin immediate' && !raced) {
          raced = true
          openHistoryDb(file).close()
        }
        slow.exec(sql)
      },
      prepare: (sql: string) => slow.prepare(sql),
    }
    try {
      expect(() => prepareSchema(spied)).not.toThrow()
    } finally {
      slow.close()
    }
    expect(raced).toBe(true)
    expect(
      inspect((db) =>
        db
          .prepare(
            "select count(*) as c from sqlite_master where name = 'files'",
          )
          .get(),
      ),
    ).toEqual({ c: 1 })
  })

  it('refuses a database from a newer schema', () => {
    const raw = new DatabaseSync(file)
    raw.exec('pragma user_version = 99')
    raw.close()
    expect(() => openHistoryDb(file)).toThrow(/schema/i)
  })

  it('keeps Versions across a restart', () => {
    const first = open()
    for (let index = 0; index < 220; index += 1)
      first.record(PATH, edit(`version ${index}`, index))
    first.close()
    const versions = open().list(PATH)
    expect(versions).toHaveLength(220)
    expect(open().text(PATH, versions[219]?.id ?? -1)).toBe('version 219')
  })

  it('shares one blob between equal texts, within and across files', () => {
    const db = open()
    db.record(PATH, edit('alpha'))
    db.record(PATH, edit('beta', 2))
    db.record(PATH, edit('alpha', 3))
    db.record('/other/SKILL.md', edit('alpha'))
    expect(
      inspect((raw) => raw.prepare('select count(*) as c from blobs').get()),
    ).toEqual({ c: 2 })
    expect(
      inspect((raw) => raw.prepare('select count(*) as c from versions').get()),
    ).toEqual({ c: 4 })
  })

  it('stores the text gzipped, keyed by its SHA-256', () => {
    open().record(PATH, edit('hello ✓'))
    const row = inspect((db) =>
      db.prepare('select hash, body from blobs').get(),
    )
    const body = row?.body
    expect(body).toBeInstanceOf(Uint8Array)
    expect(gunzipSync(body as Uint8Array).toString('utf8')).toBe('hello ✓')
    expect(row?.hash).toBe(
      createHash('sha256').update('hello ✓', 'utf8').digest('hex'),
    )
  })

  it('counts the words when a Version is inserted', () => {
    open().record(PATH, edit('one two  three\nfour'))
    expect(
      inspect((db) => db.prepare('select words from versions').get()),
    ).toEqual({ words: 4 })
  })

  it('counts the words added and removed when a Version is inserted', () => {
    const db = open()
    db.record(PATH, edit('one two three'))
    db.record(PATH, edit('one 2 three four', 2))
    expect(
      inspect((raw) =>
        raw
          .prepare(
            'select words_added, words_removed from versions order by id',
          )
          .all(),
      ),
    ).toEqual([
      { words_added: 3, words_removed: 0 },
      { words_added: 2, words_removed: 1 },
    ])
  })

  it('stores the External Cause', () => {
    const db = open()
    db.record(PATH, edit('a'))
    db.record(PATH, { at: 2, cause: { kind: 'external' }, text: 'b' })
    expect(db.list(PATH).map(({ cause }) => cause.kind)).toEqual([
      'started',
      'external',
    ])
  })

  it('does not create a file row for a read', () => {
    const db = open()
    expect(db.list('/never/written.md')).toEqual([])
    expect(db.text('/never/written.md', 1)).toBeNull()
    expect(db.loadUnsaved('/never/written.md')).toBeNull()
    expect(
      inspect((raw) => raw.prepare('select count(*) as c from files').get()),
    ).toEqual({ c: 0 })
  })

  it('keeps a Version committed by a process that never closed', () => {
    const db = open()
    db.record(PATH, edit('survives'))
    const versions = inspect((raw) =>
      raw.prepare('select id from versions').all(),
    )
    expect(versions).toHaveLength(1)
  })
})

describe('unsaved text in drafts', () => {
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chiri-history-'))
    file = join(directory, 'history.sqlite')
  })

  afterEach(() => {
    for (const db of opened.splice(0)) db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const unsaved = (text: string, base = 'on disk') => ({ text, base })

  it('returns null when a file has no unsaved text', () => {
    expect(open().loadUnsaved(PATH)).toBeNull()
  })

  it('saves and loads the unsaved text of a file with the text it started from', () => {
    const db = open()
    db.saveUnsaved(PATH, unsaved('typed so far', 'the disk text'), 10)
    expect(db.loadUnsaved(PATH)).toEqual({
      text: 'typed so far',
      base: 'the disk text',
    })
  })

  it('keeps only the latest unsaved text of a file', () => {
    const db = open()
    db.saveUnsaved(PATH, unsaved('one', 'base one'), 1)
    db.saveUnsaved(PATH, unsaved('two', 'base two'), 2)
    expect(db.loadUnsaved(PATH)).toEqual({ text: 'two', base: 'base two' })
    expect(
      inspect((raw) => raw.prepare('select count(*) as c from drafts').get()),
    ).toEqual({ c: 1 })
  })

  it('keeps the unsaved text of each file apart', () => {
    const db = open()
    db.saveUnsaved(PATH, unsaved('mine'), 1)
    db.saveUnsaved('/other.md', unsaved('theirs'), 1)
    expect(db.loadUnsaved('/other.md')?.text).toBe('theirs')
    expect(db.loadUnsaved(PATH)?.text).toBe('mine')
  })

  it('clears the unsaved text of a file only', () => {
    const db = open()
    db.saveUnsaved(PATH, unsaved('mine'), 1)
    db.saveUnsaved('/other.md', unsaved('theirs'), 1)
    db.clearUnsaved(PATH)
    expect(db.loadUnsaved(PATH)).toBeNull()
    expect(db.loadUnsaved('/other.md')?.text).toBe('theirs')
  })

  it('keeps the base as a blob shared with the Version that holds the same text', () => {
    const db = open()
    db.record(PATH, edit('the disk text'))
    db.saveUnsaved(PATH, unsaved('typed', 'the disk text'), 1)
    expect(
      inspect((raw) => raw.prepare('select count(*) as c from blobs').get()),
    ).toEqual({ c: 1 })
    expect(
      inspect((raw) => raw.prepare('select base_hash from drafts').get()),
    ).toEqual({
      base_hash: createHash('sha256').update('the disk text').digest('hex'),
    })
  })

  it('keeps an empty base, as for a Document with no file', () => {
    const db = open()
    db.saveUnsaved('scratch:document', { text: 'typed', base: '' }, 1)
    expect(db.loadUnsaved('scratch:document')).toEqual({
      text: 'typed',
      base: '',
    })
  })

  it('comes back after the database is closed and reopened', () => {
    const first = open()
    first.saveUnsaved(PATH, unsaved('before the crash', 'base'), 1)
    first.close()
    expect(open().loadUnsaved(PATH)).toEqual({
      text: 'before the crash',
      base: 'base',
    })
  })

  it('is readable by another connection while the first one is still open', () => {
    open().saveUnsaved(PATH, unsaved('killed mid-edit'), 1)
    const text = inspect((db) => db.prepare('select text from drafts').get())
    expect(text).toEqual({ text: 'killed mid-edit' })
  })
})

describe('thin', () => {
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chiri-history-'))
    file = join(directory, 'history.sqlite')
  })

  afterEach(() => {
    for (const db of opened.splice(0)) db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const DAY = 86_400_000
  const NOW = 200 * DAY

  it('removes old Edited Versions inside the same hour and their orphan blobs', () => {
    const db = open()
    const base = NOW - 10 * DAY
    db.record(PATH, edit('one', base))
    db.record(PATH, edit('one two', base + 60_000))
    db.record(PATH, edit('one two three', base + 120_000))
    db.record(PATH, edit('one two three four', base + 180_000))
    db.record(PATH, edit('one two three four five', NOW))
    expect(db.thin(PATH, NOW)).toBe(2)
    expect(db.list(PATH).map(({ words }) => words)).toEqual([1, 4, 5])
    expect(
      inspect((raw) => raw.prepare('select count(*) as n from blobs').get()),
    ).toEqual({ n: 3 })
  })

  it('keeps a text a draft still builds on', () => {
    const db = open()
    const base = NOW - 10 * DAY
    db.record(PATH, edit('old', base))
    db.record(PATH, edit('old text', base + 1000))
    db.record(PATH, edit('newest', NOW))
    db.saveUnsaved(PATH, { text: 'old text plus', base: 'old' }, NOW)
    db.thin(PATH, NOW)
    expect(db.loadUnsaved(PATH)).toEqual({ text: 'old text plus', base: 'old' })
  })

  it('does nothing for a History with nothing to thin', () => {
    const db = open()
    db.record(PATH, edit('one', NOW - 1000))
    expect(db.thin(PATH, NOW)).toBe(0)
  })
})
