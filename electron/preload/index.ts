import { contextBridge, ipcRenderer } from 'electron'
import {
  type ChiriApi,
  EXTERNAL_CHANGES_CHANNEL,
  type ExternalChanges,
  FILE_OPEN_CHANNEL,
  FILE_READ_CHANNEL,
  FILE_SAVE_AS_CHANNEL,
  FILE_SAVE_CHANNEL,
  LIBRARY_ADD_ROOT_CHANNEL,
  LIBRARY_CREATE_SKILL_CHANNEL,
  LIBRARY_LIST_CHANNEL,
  LIBRARY_REMOVE_ROOT_CHANNEL,
  SHELL_INFO_CHANNEL,
  WATCH_FILE_CHANNEL,
} from '../api'
import { HISTORY_CHANNELS } from '../history-api'

const api: ChiriApi = {
  shellInfo: () => ipcRenderer.invoke(SHELL_INFO_CHANNEL),
  openFile: () => ipcRenderer.invoke(FILE_OPEN_CHANNEL),
  readFile: (path) => ipcRenderer.invoke(FILE_READ_CHANNEL, path),
  saveFile: (request) => ipcRenderer.invoke(FILE_SAVE_CHANNEL, request),
  saveFileAs: (request) => ipcRenderer.invoke(FILE_SAVE_AS_CHANNEL, request),
  historyList: (key) => ipcRenderer.invoke(HISTORY_CHANNELS.list, key),
  historyText: (key, id) => ipcRenderer.invoke(HISTORY_CHANNELS.text, key, id),
  historyRecord: (key, input) =>
    ipcRenderer.invoke(HISTORY_CHANNELS.record, key, input),
  historyMarkSaved: (key, input) =>
    ipcRenderer.invoke(HISTORY_CHANNELS.markSaved, key, input),
  unsavedLoad: (key) => ipcRenderer.invoke(HISTORY_CHANNELS.unsavedLoad, key),
  unsavedSave: (key, unsaved) =>
    ipcRenderer.invoke(HISTORY_CHANNELS.unsavedSave, key, unsaved),
  unsavedClear: (key) => ipcRenderer.invoke(HISTORY_CHANNELS.unsavedClear, key),
  listLibrary: () => ipcRenderer.invoke(LIBRARY_LIST_CHANNEL),
  addLibraryRoot: () => ipcRenderer.invoke(LIBRARY_ADD_ROOT_CHANNEL),
  removeLibraryRoot: (path) =>
    ipcRenderer.invoke(LIBRARY_REMOVE_ROOT_CHANNEL, path),
  watchFile: (path) => ipcRenderer.invoke(WATCH_FILE_CHANNEL, path),
  onExternalChanges: (listener) => {
    const relay = (_event: unknown, changes: ExternalChanges): void =>
      listener(changes)
    ipcRenderer.on(EXTERNAL_CHANGES_CHANNEL, relay)
    return () => {
      ipcRenderer.removeListener(EXTERNAL_CHANGES_CHANNEL, relay)
    }
  },
  createSkill: (request) =>
    ipcRenderer.invoke(LIBRARY_CREATE_SKILL_CHANNEL, request),
}

contextBridge.exposeInMainWorld('chiri', api)
