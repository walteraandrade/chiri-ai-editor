import type { HistoryWrite } from './store'
import type { AcceptedChange, VersionCause, VersionId } from './types'

type RecorderOptions = {
  readonly emit: (write: HistoryWrite) => void
  readonly now: () => number
  readonly idleMs: number
}

export type HistoryRecorder = {
  readonly edited: (text: string) => void
  readonly accepted: (input: {
    readonly before: string
    readonly text: string
    readonly changes: readonly AcceptedChange[]
  }) => void
  readonly replaced: (before: string) => void
  readonly opened: (input: {
    readonly text: string
    readonly name: string
  }) => void
  readonly external: (input: { readonly text: string }) => void
  readonly restored: (input: {
    readonly text: string
    readonly from: VersionId
  }) => void
  readonly saving: (text: string) => void
  readonly saved: (input: {
    readonly text: string
    readonly name: string
  }) => void
  readonly flush: () => void
}

type Pending = {
  readonly text: string
  readonly timer: ReturnType<typeof setTimeout>
}

export const createHistoryRecorder = ({
  emit,
  now,
  idleMs,
}: RecorderOptions): HistoryRecorder => {
  let pending: Pending | null = null

  const record = (text: string, cause: VersionCause): void =>
    emit({ type: 'version-recorded', at: now(), cause, text })

  const takePending = (): string | null => {
    const current = pending
    if (current) clearTimeout(current.timer)
    pending = null
    return current?.text ?? null
  }

  const flush = (): void => {
    const text = takePending()
    if (text !== null) record(text, { kind: 'edited' })
  }

  const settle = (before: string): void => {
    takePending()
    record(before, { kind: 'edited' })
  }

  return {
    edited: (text) => {
      takePending()
      pending = { text, timer: setTimeout(flush, idleMs) }
    },
    accepted: ({ before, text, changes }) => {
      settle(before)
      record(text, { kind: 'accepted', changes })
    },
    replaced: settle,
    opened: ({ text, name }) => record(text, { kind: 'opened', name }),
    external: ({ text }) => record(text, { kind: 'external' }),
    restored: ({ text, from }) => record(text, { kind: 'restored', from }),
    saving: settle,
    saved: ({ text, name }) =>
      emit({ type: 'version-marked-saved', at: now(), text, name }),
    flush,
  }
}
