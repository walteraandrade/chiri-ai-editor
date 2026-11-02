import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type { FileDialogs } from './dialogs'

type Env = Readonly<Record<string, string | undefined>>

const readText = (path: string): Promise<string> => readFile(path, 'utf8')

type RunMode = { readonly packaged: boolean }

export const resolveDevDialogs = (
  env: Env,
  { packaged }: RunMode,
  read: (path: string) => Promise<string> = readText,
): FileDialogs | undefined => {
  if (packaged || env.ELECTRON_RENDERER_URL === undefined) return undefined
  const pickFile = env.CHIRI_DEV_PICK_FILE?.trim() ?? ''
  if (pickFile === '' || !isAbsolute(pickFile)) return undefined
  const next = async (): Promise<string | null> => {
    try {
      const path = (await read(pickFile)).trim()
      return path === '' ? null : path
    } catch {
      return null
    }
  }
  return { pickFile: next, pickSavePath: next }
}
