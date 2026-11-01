import { isAbsolute, join, sep } from 'node:path'

export const defaultRoots = (home: string): readonly string[] => [
  join(home, '.claude', 'skills'),
  join(home, '.agents', 'skills'),
]

export const displayPath = (path: string, home: string): string =>
  path === home
    ? '~'
    : path.startsWith(`${home}${sep}`)
      ? `~${path.slice(home.length)}`
      : path

const isStorable = (value: unknown): value is string =>
  typeof value === 'string' &&
  value !== '' &&
  !value.includes('\0') &&
  isAbsolute(value)

const unique = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) === index)

export const parseStoredRoots = (text: string): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return []
    const roots: unknown = (parsed as { readonly projectRoots?: unknown })
      .projectRoots
    return Array.isArray(roots) ? unique(roots.filter(isStorable)) : []
  } catch {
    return []
  }
}

export const serializeRoots = (projectRoots: readonly string[]): string =>
  `${JSON.stringify({ projectRoots }, null, 2)}\n`

export const withRoot = (
  roots: readonly string[],
  root: string,
): readonly string[] => (roots.includes(root) ? roots : [...roots, root])

export const withoutRoot = (
  roots: readonly string[],
  root: string,
): readonly string[] => roots.filter((candidate) => candidate !== root)
