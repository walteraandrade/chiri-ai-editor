import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  app,
  type IpcMainInvokeEvent,
  ipcMain,
  net,
  protocol,
  safeStorage,
  session,
} from 'electron'
import { createAppHandler } from './app-protocol'
import { APP_SCHEME, BUNDLE_URL } from './app-url'
import { createKeyFile } from './key-file'
import { registerKeyIpc } from './key-ipc'
import { createKeyStore } from './key-store'
import { applyPasswordStore } from './password-store'
import { denyPermissions } from './security'

const KEY_FILE = 'openrouter-key.json'

export const prepareInstalledApp = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ])
  applyPasswordStore(app.commandLine, process.platform)
}

export const startInstalledApp = async ({
  appUrl,
  isTrusted,
}: {
  readonly appUrl: string
  readonly isTrusted: (event: IpcMainInvokeEvent) => boolean
}): Promise<void> => {
  const store = createKeyStore({
    safeStorage,
    file: createKeyFile(join(app.getPath('userData'), KEY_FILE)),
  })
  await store.load()
  protocol.handle(
    APP_SCHEME,
    createAppHandler({
      rendererDir: join(import.meta.dirname, '../renderer'),
      readFile,
      openRouterKey: store.current,
      fetch: (input, init) => net.fetch(input as string, init),
    }),
  )
  denyPermissions(session.defaultSession)
  registerKeyIpc({
    ipc: ipcMain,
    store,
    managed: appUrl === BUNDLE_URL,
    isTrusted,
  })
}
