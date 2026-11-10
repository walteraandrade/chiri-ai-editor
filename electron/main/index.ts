import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
} from 'electron'
import {
  LIBRARY_REQUEST_CHANNEL,
  PREFERENCES_REQUEST_CHANNEL,
  SHELL_INFO_CHANNEL,
  type ShellInfo,
  TITLE_BAR_COLORS_CHANNEL,
} from '../api'
import { resolveAppUrl } from './app-url'
import { resolveDevOptions } from './dev-options'
import { registerEvalHandlers } from './evals/register'
import { registerFileHandlers } from './files/register'
import { type HistoryAccess, registerHistory } from './history-main'
import { prepareInstalledApp, startInstalledApp } from './installed-app'
import { registerLaunches } from './launch/register'
import { migrateLegacyUserData } from './legacy-user-data'
import { registerLibraryHandlers } from './library/register'
import { menuTemplate } from './menu-template'
import { registerQuickActionsIpc } from './quick-actions/quick-actions-ipc'
import { isAppNavigation, isTrustedFrame } from './trust'
import { registerExternalChanges } from './watch/register'
import {
  parseTitleBarColors,
  TITLE_BAR_HEIGHT,
  windowChrome,
} from './window-chrome'

const CANVAS_COLOR = '#051230'
const INITIAL_TITLE_BAR = { color: '#1e0e3f', symbolColor: '#ffdd00' } as const

const devServerUrl = process.env.ELECTRON_RENDERER_URL

const appUrl = (): string =>
  resolveAppUrl({ packaged: app.isPackaged, devServerUrl })

const applyDevOptions = (): void => {
  const { debugPort, userDataDir } = resolveDevOptions(process.env, {
    devServer: devServerUrl !== undefined,
    packaged: app.isPackaged,
  })
  if (userDataDir !== undefined) app.setPath('userData', userDataDir)
  else
    migrateLegacyUserData({
      target: app.getPath('userData'),
      appData: app.getPath('appData'),
    })
  if (debugPort !== undefined)
    app.commandLine.appendSwitch('remote-debugging-port', String(debugPort))
}

const registerIpc = (history: HistoryAccess): void => {
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
  ipcMain.on(TITLE_BAR_COLORS_CHANNEL, (event, input: unknown) => {
    if (!isTrustedFrame(event.senderFrame, appUrl())) return
    const colors = parseTitleBarColors(input)
    if (colors === null || process.platform === 'darwin') return
    BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay({
      ...colors,
      height: TITLE_BAR_HEIGHT,
    })
  })
  registerFileHandlers(isTrusted)
  const library = registerLibraryHandlers(isTrusted)
  registerExternalChanges(isTrusted, library)
  registerEvalHandlers(isTrusted, library.deps, history)
  registerQuickActionsIpc({
    ipc: ipcMain,
    userDataDir: app.getPath('userData'),
    isTrusted,
  })
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
    ...windowChrome(process.platform, INITIAL_TITLE_BAR),
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

const start = (): void => {
  prepareInstalledApp()
  lockNavigation()
  registerLaunches((event) => isTrustedFrame(event.senderFrame, appUrl()))

  app.whenReady().then(async () => {
    await startInstalledApp({
      appUrl: appUrl(),
      isTrusted: (event) => isTrustedFrame(event.senderFrame, appUrl()),
    })
    const history = registerHistory({
      ipcMain,
      file: () => join(app.getPath('userData'), 'history.sqlite'),
      isTrusted: (event) => isTrustedFrame(event.senderFrame, appUrl()),
      onQuit: (close) => app.on('will-quit', close),
    })
    registerIpc(history)
    const window = createWindow()
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        menuTemplate(
          () => window.webContents.send(PREFERENCES_REQUEST_CHANNEL),
          () => window.webContents.send(LIBRARY_REQUEST_CHANNEL),
        ),
      ),
    )
  })
}

applyDevOptions()
if (app.requestSingleInstanceLock()) start()
else app.quit()

app.on('window-all-closed', () => {
  app.quit()
})
