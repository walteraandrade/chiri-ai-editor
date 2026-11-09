import { isAbsolute } from 'node:path'
import { parsePort } from '../../config/ports'

export const DEFAULT_CDP_PORT = 9222

export type RunMode = {
  readonly devServer: boolean
  readonly packaged: boolean
}

export type DevOptions = {
  readonly debugPort: number | undefined
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
  { devServer, packaged }: RunMode,
): DevOptions =>
  packaged
    ? { debugPort: undefined, userDataDir: undefined }
    : {
        debugPort: devServer
          ? (parsePort('DESAFINADO_CDP_PORT', env.DESAFINADO_CDP_PORT) ??
            DEFAULT_CDP_PORT)
          : undefined,
        userDataDir: parseDirectory(
          'DESAFINADO_USER_DATA_DIR',
          env.DESAFINADO_USER_DATA_DIR,
        ),
      }
