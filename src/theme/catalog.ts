import { BOOK_PALETTES, type Palette, type PaletteColor } from './book-palettes'
import type { ThemeRoles, ThemeTokens } from './tokens'

export { BOOK_PALETTES } from './book-palettes'

export type ThemeOption = {
  readonly id: string
  readonly title: string
  readonly origin: string
  readonly colors: readonly PaletteColor[]
  readonly tokens: ThemeTokens
}

const rolesOf = ({ colors, jobs }: Palette): ThemeRoles => {
  const code = (name: string): string => {
    const color = colors.find((candidate) => candidate.name === name)
    if (!color) throw new Error(`No color named ${name}`)
    return color.hex
  }
  const accent = jobs.accent ?? jobs.ink
  const hairline =
    jobs.hairline ?? jobs.scrollbar ?? jobs.accent ?? jobs.fill ?? jobs.ink
  return {
    canvas: code(jobs.canvas),
    raised: code(jobs.raised),
    ink: code(jobs.ink),
    faint: code(accent),
    accent: code(accent),
    ai: code(jobs.ai),
    danger: code(jobs.danger),
    selection: code(jobs.selection ?? jobs.raised),
    fill: code(jobs.fill ?? jobs.raised),
    fillHover: code(jobs.fill ? jobs.raised : jobs.canvas),
    hairline: code(hairline),
    scrollbar: code(jobs.scrollbar ?? hairline),
  }
}

const optionOf = (palette: Palette): ThemeOption => ({
  id: palette.id,
  title: palette.title,
  origin: `#${palette.source[0]} + #${palette.source[1]}`,
  colors: palette.colors,
  tokens: { name: palette.id, mode: palette.mode, roles: rolesOf(palette) },
})

export const CHIRI_THEME: ThemeOption = {
  id: 'chiri',
  title: 'Chiri',
  origin: 'The original theme',
  colors: [
    { name: 'Graphite', hex: '#141417' },
    { name: 'Raised graphite', hex: '#28282d' },
    { name: 'Paper white', hex: '#f1f1f3' },
    { name: 'Ember', hex: '#e37545' },
  ],
  tokens: {
    name: 'chiri',
    mode: 'dark',
    roles: {
      canvas: '#141417',
      raised: '#28282d',
      ink: '#f1f1f3',
      faint: '#a6a6ab',
      accent: '#e37545',
      ai: '#e37545',
      danger: '#f87171',
      selection: '#3a241b',
      fill: '#222226',
      fillHover: '#303035',
      hairline: '#333338',
      scrollbar: '#46464b',
    },
  },
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  CHIRI_THEME,
  ...BOOK_PALETTES.map(optionOf),
]

export const themeById = (id: string): ThemeOption | null =>
  THEME_OPTIONS.find((option) => option.id === id) ?? null
