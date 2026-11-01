import { builtinModules } from 'node:module'

const PATTERNS = [
  /^\s*(?:import|export)\b[^;'"`]*?\bfrom\s*["']([^"']+)["']/gm,
  /^\s*import\s*["']([^"']+)["']/gm,
  /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g,
]

const packageName = (specifier: string): string => {
  const parts = specifier.split('/')
  return specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : (parts[0] ?? '')
}

const isIgnored = (specifier: string): boolean =>
  specifier.startsWith('.') ||
  specifier.startsWith('node:') ||
  specifier === 'electron' ||
  builtinModules.includes(specifier) ||
  builtinModules.includes(specifier.split('/')[0] ?? '')

export const bareImports = (source: string): string[] =>
  [
    ...new Set(
      PATTERNS.flatMap((pattern) =>
        [...source.matchAll(pattern)].map((match) => match[1] ?? ''),
      )
        .filter((specifier) => !isIgnored(specifier))
        .map(packageName),
    ),
  ].sort()
