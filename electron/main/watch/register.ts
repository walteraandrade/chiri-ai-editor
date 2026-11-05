import { realpath } from 'node:fs/promises'
import { app, BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { EXTERNAL_CHANGES_CHANNEL, WATCH_FILE_CHANNEL } from '../../api'
import { listLibrary } from '../library/handlers'
import type { LibraryHandle } from '../library/register'
import { createExternalChanges } from './external-changes'
import {
  directoryIdentity,
  nodeDirectoryWatch,
  rootEntries,
} from './node-watch'
import { parseWatchRequest } from './requests'

type Trust = (event: IpcMainInvokeEvent) => boolean

export const registerExternalChanges = (
  isTrusted: Trust,
  library: LibraryHandle,
): void => {
  const controller = createExternalChanges({
    list: () => listLibrary(library.deps),
    realPath: (path) => realpath(path),
    identityOf: directoryIdentity,
    watch: nodeDirectoryWatch,
    rootEntries,
    emit: (changes) => {
      for (const window of BrowserWindow.getAllWindows())
        if (!window.isDestroyed() && !window.webContents.isDestroyed())
          window.webContents.send(EXTERNAL_CHANGES_CHANNEL, changes)
    },
    onProblem: (message, error) => console.warn(message, error),
  })
  library.onRootsSaved(() => void controller.rootsChanged())
  ipcMain.handle(WATCH_FILE_CHANNEL, async (event, input: unknown) => {
    if (!isTrusted(event)) throw new Error('Untrusted sender')
    const request = parseWatchRequest(input)
    if (request === null) throw new Error('Invalid request')
    await controller.watchFile(request.path)
  })
  app.on('will-quit', controller.close)
  void controller.start()
}
