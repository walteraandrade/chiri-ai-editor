import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createElectronHistoryStore } from '../../src/history/electron-store'
import { describeHistoryStoreContract } from '../../src/history/store-contract'
import type { HistoryApi } from '../history-api'
import { type HistoryDb, openHistoryDb } from './history-db'
import { createHistoryHandlers, type HistoryHandlers } from './history-handlers'

const bridgeOf = (handlers: HistoryHandlers): HistoryApi => ({
  historyList: async (key) => handlers.list(key),
  historyText: async (key, id) => handlers.text(key, id),
  historyRecord: async (key, input) => handlers.record(key, input),
  historyMarkSaved: async (key, input) => handlers.markSaved(key, input),
  unsavedLoad: async (key) => handlers.loadUnsaved(key),
  unsavedSave: async (key, unsaved) => handlers.saveUnsaved(key, unsaved),
  unsavedClear: async (key) => handlers.clearUnsaved(key),
})

describeHistoryStoreContract(
  'the SQLite adapter',
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'desafinado-contract-'))
    const db = openHistoryDb(join(directory, 'history.sqlite'))
    return {
      store: createElectronHistoryStore(
        bridgeOf(createHistoryHandlers(db, () => 1)),
      ),
      dispose: () => {
        db.close()
        rmSync(directory, { recursive: true, force: true })
      },
    }
  },
  { cap: null, perFile: true },
)

describe('createHistoryHandlers', () => {
  let directory = ''
  let db: HistoryDb
  let handlers: HistoryHandlers

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'desafinado-handlers-'))
    db = openHistoryDb(join(directory, 'history.sqlite'))
    handlers = createHistoryHandlers(db, () => 42)
  })

  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const goodRecord = { at: 1, cause: { kind: 'edited' }, text: 'text' }

  it('rejects a key that is not a plain non-empty string', () => {
    const keys: readonly unknown[] = [
      undefined,
      null,
      42,
      {},
      '',
      'has\0nul',
      'k'.repeat(5000),
    ]
    for (const key of keys) {
      expect(() => handlers.list(key)).toThrow(/key/i)
      expect(() => handlers.record(key, goodRecord)).toThrow(/key/i)
      expect(() => handlers.loadUnsaved(key)).toThrow(/key/i)
    }
  })

  it('rejects a Version id that is not a positive integer', () => {
    for (const id of [undefined, '1', 0, -1, 1.5, Number.NaN])
      expect(() => handlers.text('file', id)).toThrow(/id/i)
  })

  it('rejects a record input of the wrong shape', () => {
    const inputs: readonly unknown[] = [
      undefined,
      null,
      'text',
      { ...goodRecord, text: 5 },
      { ...goodRecord, at: '1' },
      { ...goodRecord, at: 1.5 },
      { ...goodRecord, cause: { kind: 'merged' } },
      { ...goodRecord, cause: undefined },
    ]
    for (const input of inputs)
      expect(() => handlers.record('file', input)).toThrow(/record/i)
    expect(handlers.list('file')).toEqual([])
  })

  it('rejects a text over the size limit', () => {
    const huge = 'x'.repeat(16 * 1024 * 1024 + 1)
    expect(() =>
      handlers.record('file', { ...goodRecord, text: huge }),
    ).toThrow(/record/i)
    expect(() =>
      handlers.saveUnsaved('file', { text: huge, base: 'base' }),
    ).toThrow(/unsaved/i)
    expect(() =>
      handlers.saveUnsaved('file', { text: 'text', base: huge }),
    ).toThrow(/unsaved/i)
  })

  it('rejects unsaved text of the wrong shape', () => {
    const inputs: readonly unknown[] = [
      undefined,
      null,
      'text',
      { text: 'only text' },
      { base: 'only base' },
      { text: 1, base: 'base' },
      { text: 'text', base: null },
    ]
    for (const input of inputs)
      expect(() => handlers.saveUnsaved('file', input)).toThrow(/unsaved/i)
    expect(handlers.loadUnsaved('file')).toBeNull()
  })

  it('rejects a mark-saved input of the wrong shape', () => {
    const inputs: readonly unknown[] = [
      undefined,
      { text: 'a', name: '', at: 1 },
      { text: 'a', name: 'n', at: Number.NaN },
      { text: 1, name: 'n', at: 1 },
    ]
    for (const input of inputs)
      expect(() => handlers.markSaved('file', input)).toThrow(/saved/i)
  })

  it('accepts a valid record, including the External Cause', () => {
    handlers.record('file', goodRecord)
    handlers.record('file', {
      at: 2,
      cause: { kind: 'external' },
      text: 'changed on disk',
    })
    expect(handlers.list('file').map(({ cause }) => cause.kind)).toEqual([
      'started',
      'external',
    ])
  })

  it('stamps unsaved text with its own clock', () => {
    handlers.saveUnsaved('file', { text: 'unsaved', base: 'on disk' })
    expect(handlers.loadUnsaved('file')).toEqual({
      text: 'unsaved',
      base: 'on disk',
    })
    const raw = new DatabaseSync(join(directory, 'history.sqlite'))
    try {
      expect(raw.prepare('select at from drafts').get()).toEqual({ at: 42 })
    } finally {
      raw.close()
    }
  })
})
