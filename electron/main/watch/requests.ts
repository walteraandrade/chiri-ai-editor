import { isMarkdownPath } from '../files/markdown-path'
import { parsePathRequest } from '../files/requests'

export type WatchRequest = { readonly path: string | null }

export const parseWatchRequest = (input: unknown): WatchRequest | null => {
  if (input === null) return { path: null }
  const path = parsePathRequest(input)
  return path !== null && isMarkdownPath(path) ? { path } : null
}
