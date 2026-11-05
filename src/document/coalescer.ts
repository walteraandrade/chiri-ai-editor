export type Coalescer = {
  readonly request: () => Promise<void>
}

export const createCoalescer = (task: () => Promise<void>): Coalescer => {
  let running: Promise<void> | null = null
  let again = false

  const loop = async (): Promise<void> => {
    do {
      again = false
      await task().catch(() => undefined)
    } while (again)
    running = null
  }

  return {
    request: () => {
      if (running === null) running = loop()
      else again = true
      return running
    },
  }
}
