type AutosaveOptions = {
  readonly save: (text: string) => void
  readonly delayMs: number
}

export type Autosave = {
  readonly schedule: (text: string) => void
  readonly flush: () => void
  readonly cancel: () => void
}

type Pending = {
  readonly text: string
  readonly timer: ReturnType<typeof setTimeout>
}

export const createAutosave = ({
  save,
  delayMs,
}: AutosaveOptions): Autosave => {
  let pending: Pending | null = null

  const cancel = () => {
    if (pending) clearTimeout(pending.timer)
    pending = null
  }

  const flush = () => {
    const current = pending
    cancel()
    if (current) save(current.text)
  }

  const schedule = (text: string) => {
    cancel()
    pending = { text, timer: setTimeout(flush, delayMs) }
  }

  return { schedule, flush, cancel }
}
