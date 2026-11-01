const FILE_ORIGIN = 'file://'

const parse = (url: string): URL | null => {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

const originOf = (url: URL): string =>
  url.protocol === 'file:' ? FILE_ORIGIN : `${url.protocol}//${url.host}`

export const appOrigin = (appUrl: string): string => {
  const parsed = parse(appUrl)
  return parsed === null ? FILE_ORIGIN : originOf(parsed)
}

export const isAppNavigation = (target: string, appUrl: string): boolean => {
  const to = parse(target)
  const app = parse(appUrl)
  if (to === null || app === null) return false
  return app.protocol === 'file:'
    ? to.protocol === 'file:' && to.pathname === app.pathname
    : originOf(to) === originOf(app)
}

export const isTrustedFrame = (
  frame: { readonly origin: string } | null,
  appUrl: string,
): boolean => frame !== null && frame.origin === appOrigin(appUrl)
