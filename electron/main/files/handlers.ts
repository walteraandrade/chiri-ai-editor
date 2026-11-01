import type { FileReadResult, FileSaveResult } from '../../api'
import { withMarkdownExtension } from './markdown-path'
import { readMarkdown } from './read-markdown'
import {
  parsePathRequest,
  parseSaveAsRequest,
  parseSaveRequest,
} from './requests'
import { saveMarkdown, saveMarkdownAs } from './save-markdown'

const CANCELLED = { kind: 'cancelled' } as const
const INVALID = { kind: 'failed', reason: 'Invalid request' } as const

export const openFile = async (
  pick: () => Promise<string | null>,
): Promise<FileReadResult> => {
  const path = await pick()
  return path === null ? CANCELLED : readMarkdown(path)
}

export const readFileRequest = async (
  input: unknown,
): Promise<FileReadResult> => {
  const path = parsePathRequest(input)
  return path === null ? INVALID : readMarkdown(path)
}

export const saveFileRequest = async (
  input: unknown,
): Promise<FileSaveResult> => {
  const request = parseSaveRequest(input)
  return request === null ? INVALID : saveMarkdown(request)
}

export const saveFileAsRequest = async (
  input: unknown,
  pick: (suggestedName: string) => Promise<string | null>,
): Promise<FileSaveResult> => {
  const request = parseSaveAsRequest(input)
  if (request === null) return INVALID
  const chosen = await pick(request.suggestedName)
  return chosen === null
    ? CANCELLED
    : saveMarkdownAs({
        path: withMarkdownExtension(chosen),
        text: request.text,
      })
}
