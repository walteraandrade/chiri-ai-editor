import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '../theme/catalog'
import { titleBarColors } from './title-bar'

describe('titleBarColors', () => {
  it('paints the window controls with the raised color and ink', () => {
    expect(titleBarColors(DEFAULT_THEME.tokens.roles)).toEqual({
      color: DEFAULT_THEME.tokens.roles.raised,
      symbolColor: DEFAULT_THEME.tokens.roles.ink,
    })
  })
})
