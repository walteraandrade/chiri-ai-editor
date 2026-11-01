import { homedir } from 'node:os'
import { app, BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import {
  LIBRARY_ADD_ROOT_CHANNEL,
  LIBRARY_LIST_CHANNEL,
  LIBRARY_REMOVE_ROOT_CHANNEL,
} from '../../api'
import { resolveDevDialogs } from '../files/dev-dialogs'
import { createFileDialogs } from '../files/dialogs'
import {
  addLibraryRoot,
  type LibraryDeps,
  listLibrary,
  removeLibraryRoot,
} from './handlers'
import { nodeSkillFileSystem } from './node-skill-fs'
import { createRootsStore } from './roots-store'

type Trust = (event: IpcMainInvokeEvent) => boolean

export const registerLibraryHandlers = (isTrusted: Trust): void => {
  const dialogs =
    resolveDevDialogs(process.env, { packaged: app.isPackaged }) ??
    createFileDialogs()
  const deps: LibraryDeps = {
    home: homedir(),
    store: createRootsStore(app.getPath('userData')),
    fileSystem: nodeSkillFileSystem,
  }

  const handle = <T>(
    channel: string,
    run: (event: IpcMainInvokeEvent, input: unknown) => Promise<T>,
  ): void => {
    ipcMain.handle(channel, (event, input: unknown) => {
      if (!isTrusted(event)) throw new Error('Untrusted sender')
      return run(event, input)
    })
  }

  handle(LIBRARY_LIST_CHANNEL, () => listLibrary(deps))
  handle(LIBRARY_ADD_ROOT_CHANNEL, (event) =>
    addLibraryRoot(deps, () =>
      dialogs.pickFolder(BrowserWindow.fromWebContents(event.sender)),
    ),
  )
  handle(LIBRARY_REMOVE_ROOT_CHANNEL, (_event, input) =>
    removeLibraryRoot(deps, input),
  )
}
