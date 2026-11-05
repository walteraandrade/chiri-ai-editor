export type ThemeMode = 'light' | 'dark'

export type ThemeRoles = {
  readonly canvas: string
  readonly raised: string
  readonly ink: string
  readonly faint: string
  readonly accent: string
  readonly ai: string
  readonly danger: string
  readonly selection: string
  readonly fill: string
  readonly fillHover: string
  readonly hairline: string
  readonly scrollbar: string
}

export type ThemeTokens = {
  readonly name: string
  readonly mode: ThemeMode
  readonly roles: ThemeRoles
}

const VARIABLES = {
  canvas: '--theme-canvas',
  raised: '--theme-raised',
  ink: '--theme-ink',
  faint: '--theme-faint',
  accent: '--theme-accent',
  ai: '--theme-ai',
  danger: '--theme-danger',
  selection: '--theme-selection',
  fill: '--theme-fill',
  fillHover: '--theme-fill-hover',
  hairline: '--theme-hairline',
  scrollbar: '--theme-scrollbar',
} as const satisfies Readonly<Record<keyof ThemeRoles, string>>

export const THEME_VARIABLE_NAMES: readonly string[] = Object.values(VARIABLES)

export const themeVariables = ({
  roles,
}: ThemeTokens): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(VARIABLES).map(([role, variable]) => [
      variable,
      roles[role as keyof ThemeRoles],
    ]),
  )

export const themeLabel = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter((word) => word !== '')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
