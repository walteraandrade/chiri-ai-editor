export const SHELL_INFO_CHANNEL = 'shell:info'

export type ShellInfo = {
  readonly electron: string
  readonly chrome: string
  readonly platform: string
}

export type ChiriApi = {
  readonly shellInfo: () => Promise<ShellInfo>
}
