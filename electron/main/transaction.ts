import type { DatabaseSync } from 'node:sqlite'

type Executor = Pick<DatabaseSync, 'exec'>

const rollback = (db: Executor): void => {
  try {
    db.exec('rollback')
  } catch {
    return
  }
}

export const inTransaction = <T>(db: Executor, run: () => T): T => {
  db.exec('begin immediate')
  try {
    const result = run()
    db.exec('commit')
    return result
  } catch (error) {
    rollback(db)
    throw error
  }
}
