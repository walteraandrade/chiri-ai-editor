import { randomUUID } from 'node:crypto'
import { open, rename, stat, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { codeIs } from './fs-failure'

const NEW_FILE_MODE = 0o644
const MODE_MASK = 0o777

type TemporaryHandle = {
  readonly writeFile: (text: string, encoding: 'utf8') => Promise<void>
  readonly chmod: (mode: number) => Promise<void>
  readonly sync: () => Promise<void>
  readonly close: () => Promise<void>
}

export type AtomicFs = {
  readonly stat: (path: string) => Promise<{ readonly mode: number }>
  readonly open: (
    path: string,
    flags: 'wx',
    mode: number,
  ) => Promise<TemporaryHandle>
  readonly rename: (from: string, to: string) => Promise<void>
  readonly unlink: (path: string) => Promise<void>
}

export type AtomicOutcome = 'written' | 'rejected'

export const nodeFs: AtomicFs = { stat, open, rename, unlink }

const alwaysAccept = async (): Promise<boolean> => true

const modeOf = async (fs: AtomicFs, target: string): Promise<number> => {
  try {
    return (await fs.stat(target)).mode & MODE_MASK
  } catch (error) {
    if (codeIs(error, 'ENOENT')) return NEW_FILE_MODE
    throw error
  }
}

const writeTemporary = async (
  fs: AtomicFs,
  temporary: string,
  text: string,
  mode: number,
): Promise<void> => {
  const handle = await fs.open(temporary, 'wx', mode)
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
  accept: () => Promise<boolean> = alwaysAccept,
  fs: AtomicFs = nodeFs,
): Promise<AtomicOutcome> => {
  const mode = await modeOf(fs, target)
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomUUID()}.tmp`,
  )
  try {
    await writeTemporary(fs, temporary, text, mode)
    if (!(await accept())) {
      await fs.unlink(temporary).catch(() => undefined)
      return 'rejected'
    }
    await fs.rename(temporary, target)
    return 'written'
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined)
    throw error
  }
}
