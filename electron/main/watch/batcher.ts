type BatcherOptions<T> = {
  readonly delayMs: number
  readonly maxWaitMs: number
  readonly flush: (items: readonly T[]) => void
}

export type Batcher<T> = {
  readonly add: (item: T) => void
  readonly cancel: () => void
}

export const createBatcher = <T>({
  delayMs,
  maxWaitMs,
  flush,
}: BatcherOptions<T>): Batcher<T> => {
  let items: T[] = []
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const stop = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const release = (): void => {
    const batch = items
    items = []
    stop()
    if (batch.length > 0) flush(batch)
  }

  return {
    add: (item) => {
      if (items.length === 0) startedAt = Date.now()
      items.push(item)
      stop()
      const waitedLeft = startedAt + maxWaitMs - Date.now()
      timer = setTimeout(release, Math.max(0, Math.min(delayMs, waitedLeft)))
    },
    cancel: () => {
      items = []
      stop()
    },
  }
}
