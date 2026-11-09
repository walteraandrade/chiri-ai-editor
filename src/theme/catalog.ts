import { BOOK_PALETTES, type Palette, type PaletteColor } from './book-palettes'
import {
  type ThemeMode,
  type ThemeRoles,
  type ThemeTokens,
  themeLabel,
} from './tokens'

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

const rolesAsColors = (roles: ThemeRoles): readonly PaletteColor[] => [
  ...new Map(
    Object.entries(roles).map(([name, hex]) => [hex, { name, hex }]),
  ).values(),
]

const optionOf = (palette: Palette): ThemeOption => ({
  id: palette.id,
  title: palette.title,
  origin: `#${palette.source[0]} + #${palette.source[1]}`,
  colors: palette.colors,
  tokens: { name: palette.id, mode: palette.mode, roles: rolesOf(palette) },
})

const DESAFINADO_ROLES: ThemeRoles = {
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
}

export const DESAFINADO_THEME: ThemeOption = {
  id: 'desafinado',
  title: 'Desafinado',
  origin: 'The original theme',
  colors: rolesAsColors(DESAFINADO_ROLES),
  tokens: { name: 'desafinado', mode: 'dark', roles: DESAFINADO_ROLES },
}

export const omarchyOption = (
  id: string,
  tokens: ThemeTokens,
): ThemeOption => ({
  id,
  title: 'Omarchy',
  origin: `Follows ${themeLabel(tokens.name)}`,
  colors: rolesAsColors(tokens.roles),
  tokens,
})

export const THEME_OPTIONS: readonly ThemeOption[] = [
  DESAFINADO_THEME,
  ...BOOK_PALETTES.map(optionOf),
]

const DEFAULT_THEME_ID = 'mood-indigo'

const defaultTheme = (): ThemeOption => {
  const option = THEME_OPTIONS.find(({ id }) => id === DEFAULT_THEME_ID)
  if (!option) throw new Error(`No theme named ${DEFAULT_THEME_ID}`)
  return option
}

export const DEFAULT_THEME: ThemeOption = defaultTheme()

export const themesOfMode = (mode: ThemeMode): readonly ThemeOption[] =>
  THEME_OPTIONS.filter((option) => option.tokens.mode === mode)

export const themeById = (id: string): ThemeOption | null =>
  THEME_OPTIONS.find((option) => option.id === id) ?? null
