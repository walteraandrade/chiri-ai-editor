import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  omarchyTheme,
  omarchyTokens,
  parseColorsToml,
  readOmarchyTheme,
} from './omarchy-theme'

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

  it('trusts an explicit mode over the background', () => {
    expect(
      omarchyTokens(
        {
          mode: 'light',
          background: '#101010',
          foreground: '#888888',
          accent: '#ff0000',
        },
        'x',
      )?.mode,
    ).toBe('light')
  })

  it('reads short hex and ignores an unknown mode', () => {
    expect(
      omarchyTokens(
        {
          mode: 'dim',
          background: '#fff',
          foreground: '#333',
          accent: '#f00',
        },
        'x',
      )?.mode,
    ).toBe('light')
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

const stateDir = (files: Readonly<Record<string, string>>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-'))
  mkdirSync(join(dir, 'theme'))
  for (const [path, text] of Object.entries(files))
    writeFileSync(join(dir, path), text)
  return dir
}

describe('readOmarchyTheme', () => {
  it('reads the current theme and its name', () => {
    const dir = stateDir({
      'theme/colors.toml': TOKYO_NIGHT,
      'theme.name': 'tokyo-night\n',
    })
    expect(readOmarchyTheme(dir)).toMatchObject({
      name: 'tokyo-night',
      bg: '#1a1b26',
    })
  })

  it('falls back to a generic name without theme.name', () => {
    const dir = stateDir({ 'theme/colors.toml': TOKYO_NIGHT })
    expect(readOmarchyTheme(dir)?.name).toBe('omarchy')
  })

  it('is null without colors.toml', () => {
    expect(readOmarchyTheme(stateDir({}))).toBeNull()
  })
})

type Hooks = {
  readonly configResolved: (config: { readonly command: string }) => void
  readonly resolveId: (id: string) => string | null
  readonly load: (id: string) => string | null
}

const themeModule = (command: 'serve' | 'build', dir: string) => {
  const plugin = omarchyTheme(dir) as unknown as Hooks
  plugin.configResolved({ command })
  return plugin.load(plugin.resolveId('virtual:omarchy-theme') ?? '')
}

describe('omarchyTheme plugin', () => {
  const dir = stateDir({
    'theme/colors.toml': TOKYO_NIGHT,
    'theme.name': 'tokyo-night',
  })

  it('serves the current theme to the dev server', () => {
    expect(themeModule('serve', dir)).toContain('"name":"tokyo-night"')
  })

  it('never bakes the machine theme into a build', () => {
    expect(themeModule('build', dir)).toBe('export default null')
  })
})
