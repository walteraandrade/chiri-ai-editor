import { describe, expect, it } from 'vitest'
import { devServerOptions, parsePort } from './ports'

describe('parsePort', () => {
  it('returns undefined when the variable is not set', () => {
    expect(parsePort('DESAFINADO_DEV_PORT', undefined)).toBeUndefined()
  })

  it('returns undefined when the variable is empty', () => {
    expect(parsePort('DESAFINADO_DEV_PORT', '')).toBeUndefined()
    expect(parsePort('DESAFINADO_DEV_PORT', '   ')).toBeUndefined()
  })

  it('parses a port number', () => {
    expect(parsePort('DESAFINADO_DEV_PORT', '5301')).toBe(5301)
    expect(parsePort('DESAFINADO_DEV_PORT', ' 9301 ')).toBe(9301)
  })

  it.each(['0', '65536', '-1', '53.01', 'abc', '5301x', '0x10'])(
    'rejects %s and names the variable',
    (raw) => {
      expect(() => parsePort('DESAFINADO_DEV_PORT', raw)).toThrow(
        /DESAFINADO_DEV_PORT/,
      )
    },
  )
})

describe('devServerOptions', () => {
  it('leaves the port to Vite when none is configured', () => {
    expect(devServerOptions({})).toEqual({})
  })

  it('fixes the port and refuses to move when one is configured', () => {
    expect(devServerOptions({ DESAFINADO_DEV_PORT: '5301' })).toEqual({
      port: 5301,
      strictPort: true,
    })
  })

  it('fails on an invalid port', () => {
    expect(() => devServerOptions({ DESAFINADO_DEV_PORT: 'nope' })).toThrow(
      /DESAFINADO_DEV_PORT/,
    )
  })
})
