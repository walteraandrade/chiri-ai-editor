import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { mixHex } from '../src/theme/color.ts'
import {
  OMARCHY_THEME_EVENT,
  OMARCHY_THEME_MODULE,
} from '../src/theme/omarchy-protocol.ts'
import type { ThemeMode, ThemeTokens } from '../src/theme/tokens.ts'

const RESOLVED_MODULE = `\0${OMARCHY_THEME_MODULE}`
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const PAIR = /^([A-Za-z0-9_-]+)\s*=\s*(["'])(.*?)\2\s*(?:#.*)?$/

type Colors = Readonly<Record<string, string>>

export const parseColorsToml = (text: string): Colors =>
  Object.fromEntries(
    text.split('\n').flatMap((line) => {
      const match = PAIR.exec(line.trim())
      return match?.[1] && match[3] !== undefined ? [[match[1], match[3]]] : []
    }),
  )

const hexOf = (colors: Colors, key: string): string | null => {
  const value = colors[key]
  return value !== undefined && HEX.test(value) ? value : null
}

const luminance = (hex: string): number => {
  const digits = hex.slice(1)
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join('')
      : digits.slice(0, 6)
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map(
    (start) => Number.parseInt(full.slice(start, start + 2), 16) / 255,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const modeOf = (colors: Colors, bg: string): ThemeMode =>
  colors.mode === 'light' || colors.mode === 'dark'
    ? colors.mode
    : luminance(bg) > 0.5
      ? 'light'
      : 'dark'

export const omarchyTokens = (
  colors: Colors,
  name: string,
): ThemeTokens | null => {
  const bg = hexOf(colors, 'background')
  const ink = hexOf(colors, 'foreground')
  const accent = hexOf(colors, 'accent')
  if (bg === null || ink === null || accent === null) return null
  const mode = modeOf(colors, bg)
  return {
    name,
    mode,
    roles: {
      canvas: bg,
      raised: hexOf(colors, 'lighter_background') ?? mixHex(bg, ink, 0.09),
      ink,
      faint: mixHex(bg, ink, 0.7),
      accent,
      ai: accent,
      danger:
        hexOf(colors, 'red') ?? (mode === 'light' ? '#b42318' : '#f87171'),
      selection: hexOf(colors, 'selection') ?? mixHex(bg, accent, 0.28),
      fill: mixHex(bg, ink, 0.06),
      fillHover: mixHex(bg, ink, 0.11),
      hairline: mixHex(bg, ink, 0.09),
      scrollbar: mixHex(bg, ink, 0.16),
    },
  }
}

const readText = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

export const readOmarchyTheme = (stateDir: string): ThemeTokens | null => {
  const toml = readText(join(stateDir, 'theme', 'colors.toml'))
  const name = readText(join(stateDir, 'theme.name'))?.trim() || 'omarchy'
  return toml === null ? null : omarchyTokens(parseColorsToml(toml), name)
}

const defaultStateDir = (): string =>
  join(homedir(), '.local', 'state', 'omarchy', 'current')

const watchTheme = (server: ViteDevServer, stateDir: string): void => {
  const nameFile = join(stateDir, 'theme.name')
  server.watcher.add(nameFile)
  server.watcher.on('all', (_event, file) => {
    if (file !== nameFile) return
    const { moduleGraph } = server.environments.client
    const module = moduleGraph.getModuleById(RESOLVED_MODULE)
    if (module) moduleGraph.invalidateModule(module)
    server.ws.send({
      type: 'custom',
      event: OMARCHY_THEME_EVENT,
      data: readOmarchyTheme(stateDir),
    })
  })
}

export const omarchyTheme = (stateDir = defaultStateDir()): Plugin => {
  let serving = false
  return {
    name: 'chiri-omarchy-theme',
    configResolved: (config) => {
      serving = config.command === 'serve'
    },
    resolveId: (id) => (id === OMARCHY_THEME_MODULE ? RESOLVED_MODULE : null),
    load: (id) =>
      id === RESOLVED_MODULE
        ? `export default ${JSON.stringify(serving ? readOmarchyTheme(stateDir) : null)}`
        : null,
    configureServer: (server) => watchTheme(server, stateDir),
  }
}
