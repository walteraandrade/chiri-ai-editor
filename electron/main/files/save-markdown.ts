import { readFile, realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { FileSaveResult, SaveFileRequest } from '../../api'
import { codeIs, describeFailure } from './fs-failure'
import { MAX_FILE_BYTES } from './limits'
import { isMarkdownPath } from './markdown-path'
import { decodeDisk } from './read-markdown'
import { decideSave } from './save-decision'
import { writeAtomic } from './write-atomic'

const NOT_MARKDOWN: FileSaveResult = {
  kind: 'failed',
  reason: 'Not a Markdown file',
}

const TOO_LARGE: FileSaveResult = {
  kind: 'failed',
  reason: 'Too large to save (over 5 MiB)',
}

const tooLarge = (text: string): boolean =>
  Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES

const savedAt = (real: string): FileSaveResult => ({
  kind: 'saved',
  path: real,
  name: basename(real),
})

const diskText = async (real: string): Promise<string | null> => {
  const info = await stat(real)
  return info.size > MAX_FILE_BYTES ? null : decodeDisk(await readFile(real))
}

const stillHolds =
  (real: string, expected: string) => async (): Promise<boolean> =>
    decideSave(await diskText(real).catch(() => null), expected) === 'write'

const resolveExisting = async (path: string): Promise<string | null> => {
  try {
    return await realpath(path)
  } catch (error) {
    if (codeIs(error, 'ENOENT')) return null
    throw error
  }
}

export const saveMarkdown = async ({
  path,
  text,
  expected,
}: SaveFileRequest): Promise<FileSaveResult> => {
  try {
    if (tooLarge(text)) return TOO_LARGE
    const real = await resolveExisting(path)
    if (real === null) return { kind: 'conflict' }
    if (!isMarkdownPath(real)) return NOT_MARKDOWN
    const holds = stillHolds(real, expected)
    if (!(await holds())) return { kind: 'conflict' }
    const outcome = await writeAtomic(real, text, holds)
    return outcome === 'rejected' ? { kind: 'conflict' } : savedAt(real)
  } catch (error) {
    return { kind: 'failed', reason: describeFailure(error) }
  }
}

export const saveMarkdownAs = async ({
  path,
  text,
}: {
  readonly path: string
  readonly text: string
}): Promise<FileSaveResult> => {
  try {
    if (tooLarge(text)) return TOO_LARGE
    const target = (await resolveExisting(path)) ?? path
    if (!isMarkdownPath(target)) return NOT_MARKDOWN
    await writeAtomic(target, text)
    return savedAt(await realpath(target))
  } catch (error) {
    return { kind: 'failed', reason: describeFailure(error) }
  }
}
