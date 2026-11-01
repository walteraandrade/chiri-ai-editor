import { randomUUID } from 'node:crypto'
import { open, rename, stat, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { codeIs } from './fs-failure'

const NEW_FILE_MODE = 0o644
const MODE_MASK = 0o777

const modeOf = async (target: string): Promise<number> => {
  try {
    return (await stat(target)).mode & MODE_MASK
  } catch (error) {
    if (codeIs(error, 'ENOENT')) return NEW_FILE_MODE
    throw error
  }
}

const writeTemporary = async (
  temporary: string,
  text: string,
  mode: number,
): Promise<void> => {
  const handle = await open(temporary, 'wx', mode)
  try {
    await handle.writeFile(text, 'utf8')
    await handle.chmod(mode)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export const writeAtomic = async (
  target: string,
  text: string,
): Promise<void> => {
  const mode = await modeOf(target)
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomUUID()}.tmp`,
  )
  try {
    await writeTemporary(temporary, text, mode)
    await rename(temporary, target)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}
