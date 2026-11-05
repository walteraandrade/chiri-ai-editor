export type CdpTarget = {
  readonly type: string
  readonly url: string
  readonly webSocketDebuggerUrl?: string
}

export const findAppPage = (
  targets: readonly CdpTarget[],
): CdpTarget | undefined =>
  targets.find(
    (target) =>
      target.type === 'page' &&
      target.url.startsWith('app://') &&
      target.webSocketDebuggerUrl !== undefined,
  )

export const isRendered = (value: unknown): boolean => value === true
