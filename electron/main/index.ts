import { join } from 'node:path'
import { app, BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { SHELL_INFO_CHANNEL, type ShellInfo } from '../api'
import { resolveAppUrl } from './app-url'
import { resolveDevOptions } from './dev-options'
import { registerFileHandlers } from './files/register'
import { registerHistory } from './history-main'
import { prepareInstalledApp, startInstalledApp } from './installed-app'
import { registerLibraryHandlers } from './library/register'
import { isAppNavigation, isTrustedFrame } from './trust'
import { registerExternalChanges } from './watch/register'

const CANVAS_COLOR = '#141417'

const devServerUrl = process.env.ELECTRON_RENDERER_URL

const appUrl = (): string =>
  resolveAppUrl({ packaged: app.isPackaged, devServerUrl })

const applyDevOptions = (): void => {
  const { debugPort, userDataDir } = resolveDevOptions(process.env, {
    devServer: devServerUrl !== undefined,
    packaged: app.isPackaged,
  })
  if (userDataDir !== undefined) app.setPath('userData', userDataDir)
  if (debugPort !== undefined)
    app.commandLine.appendSwitch('remote-debugging-port', String(debugPort))
}

const registerIpc = (): void => {
  ipcMain.handle(SHELL_INFO_CHANNEL, (event): ShellInfo => {
    if (!isTrustedFrame(event.senderFrame, appUrl()))
      throw new Error('Untrusted sender')
    return {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform,
    }
  })
  const isTrusted = (event: IpcMainInvokeEvent): boolean =>
    isTrustedFrame(event.senderFrame, appUrl())
  registerFileHandlers(isTrusted)
  registerExternalChanges(isTrusted, registerLibraryHandlers(isTrusted))
}

const lockNavigation = (): void => {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.on('will-navigate', (event, url) => {
      if (!isAppNavigation(url, appUrl())) event.preventDefault()
    })
  })
}

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    backgroundColor: CANVAS_COLOR,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  window.once('ready-to-show', () => window.show())
  window.loadURL(appUrl()).catch((error: unknown) => {
    console.error('Failed to load the app', error)
  })
  return window
}

applyDevOptions()
prepareInstalledApp()
lockNavigation()

app.whenReady().then(async () => {
  await startInstalledApp({
    appUrl: appUrl(),
    isTrusted: (event) => isTrustedFrame(event.senderFrame, appUrl()),
  })
  registerIpc()
  registerHistory({
    ipcMain,
    file: () => join(app.getPath('userData'), 'history.sqlite'),
    isTrusted: (event) => isTrustedFrame(event.senderFrame, appUrl()),
    onQuit: (close) => app.on('will-quit', close),
  })
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
