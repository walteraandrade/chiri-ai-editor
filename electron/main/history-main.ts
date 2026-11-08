import { type HistoryDb, openHistoryDb } from './history-db'
import { createHistoryHandlers, type HistoryHandlers } from './history-handlers'
import {
  type HandleEvent,
  type IpcRegistry,
  registerHistoryIpc,
} from './history-ipc'

export type HistoryAccess = {
  readonly db: () => HistoryDb
}

type RegisterHistoryOptions = {
  readonly ipcMain: IpcRegistry
  readonly isTrusted: (event: HandleEvent) => boolean
  readonly file: () => string
  readonly onQuit: (close: () => void) => void
}

export const registerHistory = ({
  ipcMain,
  isTrusted,
  file,
  onQuit,
}: RegisterHistoryOptions): HistoryAccess => {
  let db: HistoryDb | null = null
  let handlers: HistoryHandlers | null = null

  const getDb = (): HistoryDb => {
    if (db === null) db = openHistoryDb(file())
    return db
  }

  const getHandlers = (): HistoryHandlers => {
    if (handlers === null) handlers = createHistoryHandlers(getDb(), Date.now)
    return handlers
  }

  registerHistoryIpc({ ipcMain, getHandlers, isTrusted })
  onQuit(() => db?.close())
  return { db: getDb }
}
