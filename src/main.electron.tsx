import { browserElectronKit } from './platform/electron-kit'
import { withKeySettings } from './platform/key-settings'
import { mountApp } from './platform/mount'

const { desafinado } = window
if (!desafinado) throw new Error('The preload API is missing')

void mountApp(async () =>
  withKeySettings(desafinado, await browserElectronKit()),
)
