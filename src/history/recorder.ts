import { markSaved, recordVersion } from './history'
import type { AcceptedChange, History, VersionCause, VersionId } from './types'

type RecorderOptions = {
  readonly initial: History
  readonly persist: (history: History) => void
  readonly now: () => number
  readonly idleMs: number
}

export type HistoryRecorder = {
  readonly snapshot: () => History
  readonly subscribe: (listener: () => void) => () => void
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
  readonly restored: (input: {
    readonly text: string
    readonly from: VersionId
  }) => void
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
  initial,
  persist,
  now,
  idleMs,
}: RecorderOptions): HistoryRecorder => {
  let history = initial
  let pending: Pending | null = null
  const listeners = new Set<() => void>()

  const commit = (next: History): void => {
    if (next === history) return
    history = next
    persist(history)
    for (const listener of listeners) listener()
  }

  const record = (text: string, cause: VersionCause): void =>
    commit(recordVersion(history, { text, cause, at: now() }))

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
    snapshot: () => history,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
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
    restored: ({ text, from }) => record(text, { kind: 'restored', from }),
    saved: ({ text, name }) => {
      if (pending?.text === text) flush()
      commit(markSaved(history, { text, name, at: now() }))
    },
    flush,
  }
}
