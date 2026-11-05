const IDLE_TIMEOUT_MS = 2000
const FALLBACK_DELAY_MS = 1

export type IdleTarget = {
  readonly requestIdleCallback?: (
    run: () => void,
    options: { readonly timeout: number },
  ) => number
  readonly cancelIdleCallback?: (id: number) => void
  readonly setTimeout: (run: () => void, delayMs: number) => number
  readonly clearTimeout: (id: number) => void
}

export const whenIdle = (
  run: () => void,
  target: IdleTarget = window,
): (() => void) => {
  if (target.requestIdleCallback && target.cancelIdleCallback) {
    const id = target.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
    return () => target.cancelIdleCallback?.(id)
  }
  const id = target.setTimeout(run, FALLBACK_DELAY_MS)
  return () => target.clearTimeout(id)
}
