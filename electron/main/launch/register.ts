import { realpath } from 'node:fs/promises'
import { app, BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { LAUNCH_FILE_CHANNEL, LAUNCH_TAKE_CHANNEL } from '../../api'
import { createLaunchQueue } from './launch-queue'

type Trust = (event: IpcMainInvokeEvent) => boolean

const bringForward = (window: BrowserWindow): void => {
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

export const registerLaunches = (isTrusted: Trust): void => {
  const queue = createLaunchQueue({ realPath: (path) => realpath(path) })
  queue.offer(process.argv, process.cwd())
  app.on('second-instance', (_event, argv, workingDirectory) => {
    const offered = queue.offer(argv, workingDirectory)
    const [window] = BrowserWindow.getAllWindows()
    if (window === undefined || window.isDestroyed()) return
    bringForward(window)
    if (offered) window.webContents.send(LAUNCH_FILE_CHANNEL)
  })
  ipcMain.handle(LAUNCH_TAKE_CHANNEL, (event) => {
    if (!isTrusted(event)) throw new Error('Untrusted sender')
    return queue.take()
  })
}
