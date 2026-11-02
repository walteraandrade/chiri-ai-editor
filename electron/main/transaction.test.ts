import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'
import { inTransaction } from './transaction'

const createDb = () => {
  const db = new DatabaseSync(':memory:')
  db.exec('create table t (n integer not null)')
  return db
}

const count = (db: DatabaseSync): number =>
  Number((db.prepare('select count(*) as c from t').get() ?? { c: 0 }).c)

describe('inTransaction', () => {
  it('commits what the function wrote and returns its result', () => {
    const db = createDb()
    const result = inTransaction(db, () => {
      db.exec('insert into t values (1)')
      db.exec('insert into t values (2)')
      return 'done'
    })
    expect(result).toBe('done')
    expect(count(db)).toBe(2)
    expect(db.isTransaction).toBe(false)
  })

  it('rolls back every write and rethrows when the function throws', () => {
    const db = createDb()
    const failure = new Error('boom')
    expect(() =>
      inTransaction(db, () => {
        db.exec('insert into t values (1)')
        throw failure
      }),
    ).toThrow(failure)
    expect(count(db)).toBe(0)
    expect(db.isTransaction).toBe(false)
  })

  it('rolls back when a statement fails halfway', () => {
    const db = createDb()
    expect(() =>
      inTransaction(db, () => {
        db.exec('insert into t values (1)')
        db.exec('insert into t values (null)')
      }),
    ).toThrow()
    expect(count(db)).toBe(0)
  })

  it('rethrows the original error when SQLite already rolled back', () => {
    const db = createDb()
    db.exec(
      "create trigger refuse before insert on t when new.n = 7 begin select raise(rollback, 'refused by trigger'); end",
    )
    expect(() =>
      inTransaction(db, () => {
        db.exec('insert into t values (1)')
        db.exec('insert into t values (7)')
      }),
    ).toThrow('refused by trigger')
    expect(count(db)).toBe(0)
    expect(db.isTransaction).toBe(false)
  })

  it('rethrows the original error when the rollback itself throws', () => {
    const failure = new Error('disk I/O error')
    const exec = vi.fn((sql: string) => {
      if (sql === 'rollback') throw new Error('no transaction is active')
    })
    expect(() =>
      inTransaction({ exec }, () => {
        throw failure
      }),
    ).toThrow(failure)
    expect(exec).toHaveBeenCalledWith('rollback')
  })
})
