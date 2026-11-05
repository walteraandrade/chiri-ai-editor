import type { DocumentHistory } from './session'
import type { HistoryKey } from './store'
import type { VersionList } from './types'

export type SwitchableHistory<Ref> = DocumentHistory & {
  readonly select: (ref: Ref | null) => void
}

type HubOptions<Ref> = {
  readonly keyOf: (ref: Ref | null) => HistoryKey
  readonly create: (key: HistoryKey, initial?: VersionList) => DocumentHistory
  readonly first: { readonly ref: Ref | null; readonly initial: VersionList }
}

export const createSwitchableHistory = <Ref>({
  keyOf,
  create,
  first,
}: HubOptions<Ref>): SwitchableHistory<Ref> => {
  let key = keyOf(first.ref)
  let current = create(key, first.initial)
  let stopForwarding: () => void = () => undefined
  const left = new Set<DocumentHistory>()
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  const follow = (history: DocumentHistory): void => {
    stopForwarding()
    stopForwarding = history.subscribe(notify)
  }
  follow(current)

  const retire = (history: DocumentHistory): void => {
    left.add(history)
    const forget = (): void => {
      left.delete(history)
    }
    history.settled().then(forget, forget)
  }

  const select = (ref: Ref | null): void => {
    const next = keyOf(ref)
    if (next === key) return
    current.flush()
    retire(current)
    key = next
    current = create(key)
    follow(current)
    notify()
  }

  const settled = async (): Promise<void> => {
    await Promise.all([...left, current].map((history) => history.settled()))
  }

  return {
    edited: (text) => current.edited(text),
    accepted: (input) => current.accepted(input),
    replaced: (before) => current.replaced(before),
    opened: (input) => current.opened(input),
    external: (input) => current.external(input),
    restored: (input) => current.restored(input),
    saving: (text) => current.saving(text),
    saved: (input) => current.saved(input),
    flush: () => current.flush(),
    snapshot: () => current.snapshot(),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    text: (id) => current.text(id),
    settled,
    select,
  }
}
