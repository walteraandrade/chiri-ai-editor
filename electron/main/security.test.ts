import { describe, expect, it } from 'vitest'
import {
  CONTENT_SECURITY_POLICY,
  denyPermissions,
  isPermissionAllowed,
  SECURITY_HEADERS,
} from './security'

const directive = (name: string): string | undefined =>
  CONTENT_SECURITY_POLICY.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))

describe('CONTENT_SECURITY_POLICY', () => {
  it('allows scripts from the app only', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval')
  })

  it('allows inline styles only, for CodeMirror and React style attributes', () => {
    expect(directive('style-src')).toBe("style-src 'self' 'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY.match(/unsafe-inline/g)).toHaveLength(1)
  })

  it('keeps network access, framing, plugins and base changes closed', () => {
    expect(directive('default-src')).toBe("default-src 'none'")
    expect(directive('connect-src')).toBe("connect-src 'self'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'none'")
    expect(directive('form-action')).toBe("form-action 'none'")
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
  })

  it('loads fonts and images from the app or data URLs', () => {
    expect(directive('font-src')).toBe("font-src 'self' data:")
    expect(directive('img-src')).toBe("img-src 'self' data:")
  })
})

describe('SECURITY_HEADERS', () => {
  it('carries the policy and blocks sniffing and referrers', () => {
    expect(SECURITY_HEADERS['content-security-policy']).toBe(
      CONTENT_SECURITY_POLICY,
    )
    expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff')
    expect(SECURITY_HEADERS['referrer-policy']).toBe('no-referrer')
  })
})

describe('isPermissionAllowed', () => {
  it('refuses every permission the app does not use', () => {
    for (const permission of [
      'media',
      'geolocation',
      'notifications',
      'openExternal',
      'clipboard-sanitized-write',
      'midi',
      'hid',
      'usb',
    ])
      expect(isPermissionAllowed(permission)).toBe(false)
  })
})

describe('denyPermissions', () => {
  it('registers handlers that refuse requests, checks and devices', () => {
    const handlers: Record<string, unknown> = {}
    denyPermissions({
      setPermissionRequestHandler: (handler) => {
        handlers.request = handler
      },
      setPermissionCheckHandler: (handler) => {
        handlers.check = handler
      },
      setDevicePermissionHandler: (handler) => {
        handlers.device = handler
      },
    })
    const answers: boolean[] = []
    ;(
      handlers.request as (
        contents: null,
        permission: string,
        callback: (granted: boolean) => void,
      ) => void
    )(null, 'media', (granted) => answers.push(granted))
    expect(answers).toEqual([false])
    expect((handlers.check as () => boolean)()).toBe(false)
    expect((handlers.device as () => boolean)()).toBe(false)
  })
})
