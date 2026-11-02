import { describe, expect, it } from 'vitest'
import { omarchyTokens, parseColorsToml } from './omarchy-theme'

const TOKYO_NIGHT = `mode = "dark"

accent = "#7aa2f7"
selection = "#292e42"
muted = "#414868"

background = "#1a1b26"
lighter_background = "#24283b"

foreground = "#a9b1d6"
bright_foreground = "#c0caf5"

red = "#f7768e"
`

describe('parseColorsToml', () => {
  it('reads quoted key/value pairs', () => {
    expect(parseColorsToml(TOKYO_NIGHT)).toMatchObject({
      mode: 'dark',
      accent: '#7aa2f7',
      background: '#1a1b26',
    })
  })

  it('skips comments, sections and malformed lines', () => {
    const colors = parseColorsToml(
      '# comment\n[section]\naccent = "#ffffff" # trailing\nbroken =\nred = #ff0000\n',
    )
    expect(colors).toEqual({ accent: '#ffffff' })
  })

  it('accepts single quotes and spaces around the equal sign', () => {
    expect(parseColorsToml("  background='#000000'  ")).toEqual({
      background: '#000000',
    })
  })
})

describe('omarchyTokens', () => {
  it('maps an Omarchy palette to theme tokens', () => {
    expect(omarchyTokens(parseColorsToml(TOKYO_NIGHT), 'tokyo-night')).toEqual({
      name: 'tokyo-night',
      mode: 'dark',
      bg: '#1a1b26',
      raised: '#24283b',
      ink: '#a9b1d6',
      inkStrong: '#c0caf5',
      accent: '#7aa2f7',
      ai: '#7aa2f7',
      danger: '#f7768e',
      selection: '#292e42',
    })
  })

  it('returns null without background, foreground or accent', () => {
    const { accent: _accent, ...withoutAccent } = parseColorsToml(TOKYO_NIGHT)
    expect(omarchyTokens(withoutAccent, 'x')).toBeNull()
  })

  it('rejects colors that are not hex', () => {
    expect(
      omarchyTokens(
        { background: 'black', foreground: '#ffffff', accent: '#ff0000' },
        'x',
      ),
    ).toBeNull()
  })

  it('fills optional colors from the required ones', () => {
    expect(
      omarchyTokens(
        { background: '#eff1f5', foreground: '#4c4f69', accent: '#1e66f5' },
        'latte',
      ),
    ).toMatchObject({
      mode: 'light',
      raised: null,
      inkStrong: '#4c4f69',
      danger: null,
      selection: null,
    })
  })

  it('infers the mode from the background when mode is missing', () => {
    const base = { foreground: '#888888', accent: '#ff0000' }
    expect(omarchyTokens({ ...base, background: '#101010' }, 'x')?.mode).toBe(
      'dark',
    )
    expect(omarchyTokens({ ...base, background: '#fafafa' }, 'x')?.mode).toBe(
      'light',
    )
  })
})
