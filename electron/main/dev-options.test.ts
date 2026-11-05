import { describe, expect, it } from 'vitest'
import { DEFAULT_CDP_PORT, resolveDevOptions } from './dev-options'

const DEV = { devServer: true, packaged: false } as const
const PREVIEW = { devServer: false, packaged: false } as const
const PACKAGED = { devServer: false, packaged: true } as const

describe('resolveDevOptions in the dev run', () => {
  it('opens the default debugging port and keeps the default userData', () => {
    expect(resolveDevOptions({}, DEV)).toEqual({
      debugPort: DEFAULT_CDP_PORT,
      userDataDir: undefined,
    })
  })

  it('takes the debugging port from CHIRI_CDP_PORT', () => {
    expect(resolveDevOptions({ CHIRI_CDP_PORT: '9301' }, DEV).debugPort).toBe(
      9301,
    )
  })

  it('takes userData from CHIRI_USER_DATA_DIR', () => {
    expect(
      resolveDevOptions({ CHIRI_USER_DATA_DIR: '/tmp/chiri-a' }, DEV)
        .userDataDir,
    ).toBe('/tmp/chiri-a')
  })

  it('treats empty values as not set', () => {
    expect(
      resolveDevOptions({ CHIRI_CDP_PORT: ' ', CHIRI_USER_DATA_DIR: '' }, DEV),
    ).toEqual({ debugPort: DEFAULT_CDP_PORT, userDataDir: undefined })
  })

  it('rejects an invalid debugging port and names the variable', () => {
    expect(() => resolveDevOptions({ CHIRI_CDP_PORT: 'abc' }, DEV)).toThrow(
      /CHIRI_CDP_PORT/,
    )
  })

  it('rejects a relative userData path and names the variable', () => {
    expect(() =>
      resolveDevOptions({ CHIRI_USER_DATA_DIR: 'data/chiri' }, DEV),
    ).toThrow(/CHIRI_USER_DATA_DIR/)
  })
})

describe('resolveDevOptions in a preview of the built app', () => {
  it('takes userData from CHIRI_USER_DATA_DIR', () => {
    expect(
      resolveDevOptions({ CHIRI_USER_DATA_DIR: '/tmp/chiri-a' }, PREVIEW)
        .userDataDir,
    ).toBe('/tmp/chiri-a')
  })

  it('opens no debugging port, whatever CHIRI_CDP_PORT says', () => {
    expect(resolveDevOptions({}, PREVIEW).debugPort).toBeUndefined()
    expect(
      resolveDevOptions({ CHIRI_CDP_PORT: '9301' }, PREVIEW).debugPort,
    ).toBeUndefined()
    expect(
      resolveDevOptions({ CHIRI_CDP_PORT: 'abc' }, PREVIEW).debugPort,
    ).toBeUndefined()
  })

  it('rejects a relative userData path and names the variable', () => {
    expect(() =>
      resolveDevOptions({ CHIRI_USER_DATA_DIR: 'data/chiri' }, PREVIEW),
    ).toThrow(/CHIRI_USER_DATA_DIR/)
  })
})

describe('resolveDevOptions in a packaged app', () => {
  it('ignores both variables', () => {
    expect(
      resolveDevOptions(
        { CHIRI_CDP_PORT: '9301', CHIRI_USER_DATA_DIR: '/tmp/chiri-a' },
        PACKAGED,
      ),
    ).toEqual({ debugPort: undefined, userDataDir: undefined })
  })

  it('does not fail on invalid values', () => {
    expect(() =>
      resolveDevOptions(
        { CHIRI_CDP_PORT: 'abc', CHIRI_USER_DATA_DIR: 'relative' },
        PACKAGED,
      ),
    ).not.toThrow()
  })
})
