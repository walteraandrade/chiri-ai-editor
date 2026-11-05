import { HISTORY_CHANNELS } from '../history-api'
import type { HistoryHandlers } from './history-handlers'

export type HandleEvent = {
  readonly senderFrame: { readonly origin: string } | null
}

export type IpcRegistry = {
  readonly handle: (
    channel: string,
    listener: (event: HandleEvent, ...args: unknown[]) => unknown,
  ) => void
}

type HistoryIpcOptions = {
  readonly ipcMain: IpcRegistry
  readonly getHandlers: () => HistoryHandlers
  readonly isTrusted: (event: HandleEvent) => boolean
}

export const registerHistoryIpc = ({
  ipcMain,
  getHandlers,
  isTrusted,
}: HistoryIpcOptions): void => {
  const handle = (
    channel: string,
    run: (handlers: HistoryHandlers, args: readonly unknown[]) => unknown,
  ): void =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrusted(event)) throw new Error('Untrusted sender')
      return run(getHandlers(), args)
    })

  handle(HISTORY_CHANNELS.list, (h, [key]) => h.list(key))
  handle(HISTORY_CHANNELS.text, (h, [key, id]) => h.text(key, id))
  handle(HISTORY_CHANNELS.record, (h, [key, input]) => h.record(key, input))
  handle(HISTORY_CHANNELS.markSaved, (h, [key, input]) =>
    h.markSaved(key, input),
  )
  handle(HISTORY_CHANNELS.unsavedLoad, (h, [key]) => h.loadUnsaved(key))
  handle(HISTORY_CHANNELS.unsavedSave, (h, [key, unsaved]) =>
    h.saveUnsaved(key, unsaved),
  )
  handle(HISTORY_CHANNELS.unsavedClear, (h, [key]) => h.clearUnsaved(key))
}
