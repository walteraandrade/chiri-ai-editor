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
  | { readonly type: 'replaced'; readonly before: string }

export const applyHistoryEvent = (
  recorder: Pick<HistoryRecorder, 'edited' | 'accepted' | 'replaced'>,
  event: HistoryEvent,
): void => {
  if (event.type === 'edited') recorder.edited(event.text)
  else if (event.type === 'accepted') recorder.accepted(event)
  else recorder.replaced(event.before)
}
