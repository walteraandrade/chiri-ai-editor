import { contextBridge, ipcRenderer } from 'electron'
import {
  type ChiriApi,
  FILE_OPEN_CHANNEL,
  FILE_READ_CHANNEL,
  FILE_SAVE_AS_CHANNEL,
  FILE_SAVE_CHANNEL,
  SHELL_INFO_CHANNEL,
  STORAGE_FLUSH_CHANNEL,
} from '../api'

const api: ChiriApi = {
  shellInfo: () => ipcRenderer.invoke(SHELL_INFO_CHANNEL),
  openFile: () => ipcRenderer.invoke(FILE_OPEN_CHANNEL),
  readFile: (path) => ipcRenderer.invoke(FILE_READ_CHANNEL, path),
  saveFile: (request) => ipcRenderer.invoke(FILE_SAVE_CHANNEL, request),
  saveFileAs: (request) => ipcRenderer.invoke(FILE_SAVE_AS_CHANNEL, request),
  flushStorage: () => ipcRenderer.invoke(STORAGE_FLUSH_CHANNEL),
}

contextBridge.exposeInMainWorld('chiri', api)
