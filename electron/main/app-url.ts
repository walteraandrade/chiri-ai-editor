export const APP_SCHEME = 'app'
export const APP_HOST = 'chiri'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`
export const RENDERER_ENTRY = 'electron.html'
export const BUNDLE_URL = `${APP_ORIGIN}/${RENDERER_ENTRY}`

type AppUrlMode = {
  readonly packaged: boolean
  readonly devServerUrl: string | undefined
}

export const resolveAppUrl = ({
  packaged,
  devServerUrl,
}: AppUrlMode): string =>
  !packaged && devServerUrl !== undefined && devServerUrl !== ''
    ? new URL(RENDERER_ENTRY, devServerUrl).href
    : BUNDLE_URL
