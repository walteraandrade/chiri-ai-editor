import type { HistoryRecorder } from '../history/recorder'

export type UnsavedText = {
  readonly initial: string
  readonly changed: (text: string) => void
}

export type KeyStatus = {
  readonly present: boolean
}

export type PlatformKit = {
  readonly unsavedText: UnsavedText
  readonly history: HistoryRecorder
  readonly keyStatus: KeyStatus
}
