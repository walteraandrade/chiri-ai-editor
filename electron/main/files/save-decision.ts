import { decodeMarkdown } from '../../../src/document/decode-markdown'

export type SaveDecision = 'write' | 'conflict'

export const decideSave = (
  disk: string | null,
  expected: string,
): SaveDecision =>
  disk !== null && decodeMarkdown(disk) === expected ? 'write' : 'conflict'
