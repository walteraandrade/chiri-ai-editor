import { readFile, realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { decodeMarkdown } from '../../../src/document/decode-markdown'
import type { FileReadResult } from '../../api'
import { describeFailure } from './fs-failure'
import { isMarkdownPath } from './markdown-path'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

type Failed = Extract<FileReadResult, { readonly kind: 'failed' }>

const failed = (reason: string): Failed => ({ kind: 'failed', reason })

const decoder = new TextDecoder('utf-8', { fatal: true })

export const decodeDisk = (bytes: Uint8Array): string | null => {
  try {
    return decoder.decode(bytes)
  } catch {
    return null
  }
}

export const readMarkdown = async (
  path: string,
  maxBytes: number = MAX_FILE_BYTES,
): Promise<FileReadResult> => {
  try {
    const real = await realpath(path)
    if (!isMarkdownPath(real)) return failed('Not a Markdown file')
    const info = await stat(real)
    if (!info.isFile()) return failed('Not a file')
    if (info.size > maxBytes) return failed('File is too large')
    const raw = decodeDisk(await readFile(real))
    if (raw === null) return failed('Not valid UTF-8 text')
    return {
      kind: 'opened',
      path: real,
      name: basename(real),
      text: decodeMarkdown(raw),
    }
  } catch (error) {
    return failed(describeFailure(error))
  }
}
