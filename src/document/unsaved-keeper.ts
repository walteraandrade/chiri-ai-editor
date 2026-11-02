import type { UnsavedStore } from '../platform/kit'
import type { FileSession } from './file-session'

type KeeperOptions<Ref> = {
  readonly store: Pick<UnsavedStore<Ref>, 'keep' | 'drop'>
  readonly delayMs: number
}

export type UnsavedKeeper<Ref> = {
  readonly track: (text: string, file: FileSession<Ref> | null) => void
  readonly flush: () => void
}

type Pending = {
  readonly text: string
  readonly base: string
  readonly timer: ReturnType<typeof setTimeout>
}

export const createUnsavedKeeper = <Ref>({
  store,
  delayMs,
}: KeeperOptions<Ref>): UnsavedKeeper<Ref> => {
  const pending = new Map<Ref, Pending>()

  const settle = (ref: Ref): void => {
    const current = pending.get(ref)
    if (current === undefined) return
    clearTimeout(current.timer)
    pending.delete(ref)
    if (current.text === current.base) store.drop(ref)
    else store.keep(ref, { text: current.text, base: current.base })
  }

  const track = (text: string, file: FileSession<Ref> | null): void => {
    if (file === null || file.ref === null) return
    const { ref, savedText } = file
    const previous = pending.get(ref)
    if (previous !== undefined) clearTimeout(previous.timer)
    pending.set(ref, {
      text,
      base: savedText,
      timer: setTimeout(() => settle(ref), delayMs),
    })
  }

  const flush = (): void => {
    for (const ref of [...pending.keys()]) settle(ref)
  }

  return { track, flush }
}
