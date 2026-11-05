import { browserElectronKit } from './platform/electron-kit'
import { withKeySettings } from './platform/key-settings'
import { mountApp } from './platform/mount'

const { chiri } = window
if (!chiri) throw new Error('The preload API is missing')

mountApp(async () => withKeySettings(chiri, await browserElectronKit()))
