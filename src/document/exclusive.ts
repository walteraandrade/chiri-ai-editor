export type Exclusive = <T>(task: () => Promise<T>, whenBusy: T) => Promise<T>

export const createExclusive = (): Exclusive => {
  let busy = false
  return async (task, whenBusy) => {
    if (busy) return whenBusy
    busy = true
    try {
      return await task()
    } finally {
      busy = false
    }
  }
}
