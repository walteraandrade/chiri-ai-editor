import type { HistoryRecorder } from './recorder'
import type { AcceptedChange } from './types'

export type HistoryEvent =
  | { readonly type: 'edited'; readonly text: string }
  | {
      readonly type: 'accepted'
      readonly before: string
      readonly text: string
      readonly changes: readonly AcceptedChange[]
    }

export const applyHistoryEvent = (
  recorder: Pick<HistoryRecorder, 'edited' | 'accepted'>,
  event: HistoryEvent,
): void => {
  if (event.type === 'edited') recorder.edited(event.text)
  else recorder.accepted(event)
}
