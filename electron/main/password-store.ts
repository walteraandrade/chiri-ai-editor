export const PASSWORD_STORE_BACKEND = 'gnome-libsecret'

type CommandLineLike = {
  readonly hasSwitch: (name: string) => boolean
  readonly appendSwitch: (name: string, value: string) => void
}

export const applyPasswordStore = (
  commandLine: CommandLineLike,
  platform: string,
): void => {
  if (platform === 'linux' && !commandLine.hasSwitch('password-store'))
    commandLine.appendSwitch('password-store', PASSWORD_STORE_BACKEND)
}
