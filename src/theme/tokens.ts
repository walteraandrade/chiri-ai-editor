export type ThemeMode = 'light' | 'dark'

export type ThemeTokens = {
  readonly name: string
  readonly mode: ThemeMode
  readonly bg: string
  readonly raised: string | null
  readonly ink: string
  readonly inkStrong: string
  readonly accent: string
  readonly ai: string
  readonly danger: string | null
  readonly selection: string | null
  readonly solid?: Readonly<Record<string, string>>
}

const VARIABLES = {
  bg: '--theme-bg',
  raised: '--theme-raised',
  ink: '--theme-ink',
  inkStrong: '--theme-ink-strong',
  accent: '--theme-accent',
  ai: '--theme-ai',
  danger: '--theme-danger',
  selection: '--theme-selection',
} as const satisfies Readonly<Partial<Record<keyof ThemeTokens, string>>>

export const THEME_VARIABLE_NAMES: readonly string[] = Object.values(VARIABLES)

export const themeVariables = (
  tokens: ThemeTokens,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(VARIABLES).flatMap(([key, variable]) => {
      const value = tokens[key as keyof typeof VARIABLES]
      return value === null ? [] : [[variable, value]]
    }),
  )

export const themeLabel = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter((word) => word !== '')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
