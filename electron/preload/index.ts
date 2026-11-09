import { contextBridge, ipcRenderer } from 'electron'
import {
  type DesafinadoApi,
  EVALS_CANCEL_CHANNEL,
  EVALS_OPEN_REPORT_CHANNEL,
  EVALS_PREPARE_CHANNEL,
  EVALS_RUN_CHANNEL,
  EVALS_STATUS_CHANNEL,
  EXTERNAL_CHANGES_CHANNEL,
  type ExternalChanges,
  FILE_OPEN_CHANNEL,
  FILE_READ_CHANNEL,
  FILE_SAVE_AS_CHANNEL,
  FILE_SAVE_CHANNEL,
  KEY_CLEAR_CHANNEL,
  KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
  KEY_SAVE_CHANNEL,
  KEY_STATE_CHANNEL,
  LAUNCH_FILE_CHANNEL,
  LAUNCH_TAKE_CHANNEL,
  LIBRARY_ADD_ROOT_CHANNEL,
  LIBRARY_CREATE_SKILL_CHANNEL,
  LIBRARY_LIST_CHANNEL,
  LIBRARY_REMOVE_ROOT_CHANNEL,
  LIBRARY_REQUEST_CHANNEL,
  PREFERENCES_REQUEST_CHANNEL,
  QUICK_ACTIONS_LOAD_CHANNEL,
  QUICK_ACTIONS_SAVE_CHANNEL,
  SHELL_INFO_CHANNEL,
  WATCH_FILE_CHANNEL,
} from '../api'
import { HISTORY_CHANNELS } from '../history-api'

const api: DesafinadoApi = {
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
  takeLaunchFile: () => ipcRenderer.invoke(LAUNCH_TAKE_CHANNEL),
  onPreferencesRequest: (listener) => {
    const relay = (): void => listener()
    ipcRenderer.on(PREFERENCES_REQUEST_CHANNEL, relay)
    return () => {
      ipcRenderer.off(PREFERENCES_REQUEST_CHANNEL, relay)
    }
  },
  onLibraryRequest: (listener) => {
    const relay = (): void => listener()
    ipcRenderer.on(LIBRARY_REQUEST_CHANNEL, relay)
    return () => {
      ipcRenderer.off(LIBRARY_REQUEST_CHANNEL, relay)
    }
  },
  loadQuickActions: () => ipcRenderer.invoke(QUICK_ACTIONS_LOAD_CHANNEL),
  saveQuickActions: (text) =>
    ipcRenderer.invoke(QUICK_ACTIONS_SAVE_CHANNEL, text),
  onLaunchFile: (listener) => {
    const relay = (): void => listener()
    ipcRenderer.on(LAUNCH_FILE_CHANNEL, relay)
    return () => {
      ipcRenderer.removeListener(LAUNCH_FILE_CHANNEL, relay)
    }
  },
  evalStatus: (request) => ipcRenderer.invoke(EVALS_STATUS_CHANNEL, request),
  evalPrepare: (request) => ipcRenderer.invoke(EVALS_PREPARE_CHANNEL, request),
  evalRun: (request) => ipcRenderer.invoke(EVALS_RUN_CHANNEL, request),
  evalOpenReport: (request) =>
    ipcRenderer.invoke(EVALS_OPEN_REPORT_CHANNEL, request),
  evalCancel: () => ipcRenderer.invoke(EVALS_CANCEL_CHANNEL),
  keyState: () => ipcRenderer.invoke(KEY_STATE_CHANNEL),
  saveKey: (key) => ipcRenderer.invoke(KEY_SAVE_CHANNEL, key),
  keepKeyAsPlainText: () => ipcRenderer.invoke(KEY_KEEP_AS_PLAIN_TEXT_CHANNEL),
  clearKey: () => ipcRenderer.invoke(KEY_CLEAR_CHANNEL),
}

contextBridge.exposeInMainWorld('desafinado', api)
