import type { HistoryApi } from '../../electron/history-api'
import type { UnsavedStore } from './kit'

type UnsavedBridge = Pick<
  HistoryApi,
  'unsavedLoad' | 'unsavedSave' | 'unsavedClear'
>

type WriteReport = {
  readonly failed: (error: unknown) => void
  readonly worked: () => void
}

const settle = (
  send: () => Promise<void>,
  { failed, worked }: WriteReport,
): void => {
  try {
    send().then(worked, failed)
  } catch (error) {
    failed(error)
  }
}

export const createElectronUnsavedStore = (
  bridge: UnsavedBridge,
  report: WriteReport,
): UnsavedStore<string> => ({
  load: (path) => bridge.unsavedLoad(path),
  keep: (path, unsaved) =>
    settle(() => bridge.unsavedSave(path, unsaved), report),
  drop: (path) => settle(() => bridge.unsavedClear(path), report),
})
