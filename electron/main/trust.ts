const FILE_ORIGIN = 'file://'

const parse = (url: string): URL | null => {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export const appOrigin = (appUrl: string): string => {
  const parsed = parse(appUrl)
  return parsed === null || parsed.protocol === 'file:'
    ? FILE_ORIGIN
    : parsed.origin
}

export const isAppNavigation = (target: string, appUrl: string): boolean => {
  const to = parse(target)
  const app = parse(appUrl)
  if (to === null || app === null) return false
  return app.protocol === 'file:'
    ? to.protocol === 'file:' && to.pathname === app.pathname
    : to.origin === app.origin
}

export const isTrustedFrame = (
  frame: { readonly origin: string } | null,
  appUrl: string,
): boolean => frame !== null && frame.origin === appOrigin(appUrl)
