import { FILE_NOT_FOUND_REASON } from '../../api'

const REASONS: Readonly<Record<string, string>> = {
  ENOENT: FILE_NOT_FOUND_REASON,
  EACCES: 'Permission denied',
  EPERM: 'Permission denied',
  EROFS: 'Read-only file system',
  ENOSPC: 'No space left on the device',
  EISDIR: 'Not a file',
  ENOTDIR: 'Not a file',
}

const FALLBACK_REASON = 'Could not reach the file'

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined

export const codeIs = (error: unknown, code: string): boolean =>
  codeOf(error) === code

export const describeFailure = (error: unknown): string => {
  const code = codeOf(error)
  return (code !== undefined ? REASONS[code] : undefined) ?? FALLBACK_REASON
}
