import { cpSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const LEGACY_FOLDERS = ['chiri-ai-editor', 'Chiri'] as const

const APP_DATA_ENTRIES = [
  'history.sqlite',
  'quick-actions.json',
  'library-roots.json',
  'openrouter-key.json',
  'eval-runs',
  'Local Storage',
] as const

const SKIPPED_ENTRIES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Crashpad',
  'DevToolsActivePort',
  'SingletonCookie',
  'SingletonLock',
  'SingletonSocket',
])

type LegacyUserData = {
  readonly target: string
  readonly appData: string
}

const holdsAppData = (folder: string): boolean =>
  APP_DATA_ENTRIES.some((entry) => existsSync(join(folder, entry)))

const isCopied =
  (source: string) =>
  (path: string): boolean =>
    !SKIPPED_ENTRIES.has(relative(source, path).split(sep)[0] ?? '')

export const migrateLegacyUserData = ({
  target,
  appData,
}: LegacyUserData): string | undefined => {
  if (holdsAppData(target)) return undefined
  const source = LEGACY_FOLDERS.map((name) => join(appData, name)).find(
    holdsAppData,
  )
  if (source === undefined) return undefined
  cpSync(source, target, {
    recursive: true,
    force: false,
    filter: isCopied(source),
  })
  return source
}
