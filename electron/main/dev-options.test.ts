import { describe, expect, it } from 'vitest'
import { DEFAULT_CDP_PORT, resolveDevOptions } from './dev-options'

describe('resolveDevOptions', () => {
  it('opens the default debugging port and keeps the default userData', () => {
    expect(resolveDevOptions({})).toEqual({
      debugPort: DEFAULT_CDP_PORT,
      userDataDir: undefined,
    })
  })

  it('takes the debugging port from CHIRI_CDP_PORT', () => {
    expect(resolveDevOptions({ CHIRI_CDP_PORT: '9301' }).debugPort).toBe(9301)
  })

  it('takes userData from CHIRI_USER_DATA_DIR', () => {
    expect(
      resolveDevOptions({ CHIRI_USER_DATA_DIR: '/tmp/chiri-a' }).userDataDir,
    ).toBe('/tmp/chiri-a')
  })

  it('treats empty values as not set', () => {
    expect(
      resolveDevOptions({ CHIRI_CDP_PORT: ' ', CHIRI_USER_DATA_DIR: '' }),
    ).toEqual({ debugPort: DEFAULT_CDP_PORT, userDataDir: undefined })
  })

  it('rejects an invalid debugging port and names the variable', () => {
    expect(() => resolveDevOptions({ CHIRI_CDP_PORT: 'abc' })).toThrow(
      /CHIRI_CDP_PORT/,
    )
  })

  it('rejects a relative userData path and names the variable', () => {
    expect(() =>
      resolveDevOptions({ CHIRI_USER_DATA_DIR: 'data/chiri' }),
    ).toThrow(/CHIRI_USER_DATA_DIR/)
  })
})
