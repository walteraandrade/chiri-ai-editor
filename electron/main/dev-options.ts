import { isAbsolute } from 'node:path'
import { parsePort } from '../../config/ports'

export const DEFAULT_CDP_PORT = 9222

export type DevOptions = {
  readonly debugPort: number
  readonly userDataDir: string | undefined
}

const parseDirectory = (
  name: string,
  raw: string | undefined,
): string | undefined => {
  const text = raw?.trim() ?? ''
  if (text === '') return undefined
  if (!isAbsolute(text)) throw new Error(`${name} must be an absolute path`)
  return text
}

export const resolveDevOptions = (
  env: Readonly<Record<string, string | undefined>>,
): DevOptions => ({
  debugPort:
    parsePort('CHIRI_CDP_PORT', env.CHIRI_CDP_PORT) ?? DEFAULT_CDP_PORT,
  userDataDir: parseDirectory('CHIRI_USER_DATA_DIR', env.CHIRI_USER_DATA_DIR),
})
