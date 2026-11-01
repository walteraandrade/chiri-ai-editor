import { app, BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import {
  FILE_OPEN_CHANNEL,
  FILE_READ_CHANNEL,
  FILE_SAVE_AS_CHANNEL,
  FILE_SAVE_CHANNEL,
} from '../../api'
import { resolveDevDialogs } from './dev-dialogs'
import { createFileDialogs } from './dialogs'
import {
  openFile,
  readFileRequest,
  saveFileAsRequest,
  saveFileRequest,
} from './handlers'

type Trust = (event: IpcMainInvokeEvent) => boolean

const ownerOf = (event: IpcMainInvokeEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(event.sender)

export const registerFileHandlers = (isTrusted: Trust): void => {
  const dialogs =
    resolveDevDialogs(process.env, { packaged: app.isPackaged }) ??
    createFileDialogs()

  const handle = <T>(
    channel: string,
    run: (event: IpcMainInvokeEvent, input: unknown) => Promise<T>,
  ): void => {
    ipcMain.handle(channel, (event, input: unknown) => {
      if (!isTrusted(event)) throw new Error('Untrusted sender')
      return run(event, input)
    })
  }

  handle(FILE_OPEN_CHANNEL, (event) =>
    openFile(() => dialogs.pickFile(ownerOf(event))),
  )
  handle(FILE_READ_CHANNEL, (_event, input) => readFileRequest(input))
  handle(FILE_SAVE_CHANNEL, (_event, input) => saveFileRequest(input))
  handle(FILE_SAVE_AS_CHANNEL, (event, input) =>
    saveFileAsRequest(input, (name) =>
      dialogs.pickSavePath(ownerOf(event), name),
    ),
  )
}
