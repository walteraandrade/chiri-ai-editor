export const isApplePlatform = (platform: string): boolean =>
  /mac|iphone|ipad/i.test(platform)

export const formatShortcut = (key: string, apple: boolean): string =>
  apple ? `⌘${key}` : `Ctrl+${key}`

export const formatCtrlShortcut = (key: string, apple: boolean): string =>
  apple ? `⌃${key}` : `Ctrl+${key}`

type NavigatorWithUserAgentData = Navigator & {
  readonly userAgentData?: { readonly platform?: string }
}

export const detectApplePlatform = (): boolean => {
  const nav: NavigatorWithUserAgentData = navigator
  return isApplePlatform(nav.userAgentData?.platform ?? nav.platform ?? '')
}
