export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

const ALLOWED_PERMISSIONS: readonly string[] = []

export const isPermissionAllowed = (permission: string): boolean =>
  ALLOWED_PERMISSIONS.includes(permission)

type PermissionSession = {
  readonly setPermissionRequestHandler: (
    handler: (
      contents: unknown,
      permission: string,
      callback: (granted: boolean) => void,
    ) => void,
  ) => void
  readonly setPermissionCheckHandler: (handler: () => boolean) => void
  readonly setDevicePermissionHandler: (handler: () => boolean) => void
}

export const denyPermissions = (session: PermissionSession): void => {
  session.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(isPermissionAllowed(permission)),
  )
  session.setPermissionCheckHandler(() => false)
  session.setDevicePermissionHandler(() => false)
}
