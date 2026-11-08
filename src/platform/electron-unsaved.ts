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

const settle = async (
  send: () => Promise<void>,
  { failed, worked }: WriteReport,
): Promise<void> => {
  try {
    await send()
  } catch (error) {
    failed(error)
    return
  }
  worked()
}

export const createElectronUnsavedStore = (
  bridge: UnsavedBridge,
  report: WriteReport,
): UnsavedStore<string> => ({
  load: (path) => bridge.unsavedLoad(path),
  keep: (path, unsaved) => {
    void settle(() => bridge.unsavedSave(path, unsaved), report)
  },
  drop: (path) => {
    void settle(() => bridge.unsavedClear(path), report)
  },
})
