export type CdpTarget = {
  readonly type: string
  readonly url: string
  readonly webSocketDebuggerUrl?: string
}

export type AppPage = CdpTarget & { readonly webSocketDebuggerUrl: string }

const isAppPage = (target: CdpTarget): target is AppPage =>
  target.type === 'page' &&
  target.url.startsWith('app://') &&
  target.webSocketDebuggerUrl !== undefined

export const findAppPage = (
  targets: readonly CdpTarget[],
): AppPage | undefined => targets.find(isAppPage)

export const isRendered = (value: unknown): boolean => value === true
