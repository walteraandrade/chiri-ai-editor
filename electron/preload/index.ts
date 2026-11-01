import { contextBridge, ipcRenderer } from 'electron'
import { type ChiriApi, SHELL_INFO_CHANNEL } from '../api'

const api: ChiriApi = {
  shellInfo: () => ipcRenderer.invoke(SHELL_INFO_CHANNEL),
}

contextBridge.exposeInMainWorld('chiri', api)
