import { type HistoryDb, openHistoryDb } from './history-db'
import { createHistoryHandlers, type HistoryHandlers } from './history-handlers'
import {
  type HandleEvent,
  type IpcRegistry,
  registerHistoryIpc,
} from './history-ipc'

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
}: RegisterHistoryOptions): void => {
  let db: HistoryDb | null = null
  let handlers: HistoryHandlers | null = null

  const getHandlers = (): HistoryHandlers => {
    if (handlers === null) {
      db = openHistoryDb(file())
      handlers = createHistoryHandlers(db, Date.now)
    }
    return handlers
  }

  registerHistoryIpc({ ipcMain, getHandlers, isTrusted })
  onQuit(() => db?.close())
}
