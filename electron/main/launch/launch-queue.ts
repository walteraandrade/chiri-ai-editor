import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMarkdownPath } from '../files/markdown-path'

const FILE_URL = /^file:/i
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i

const fromFileUrl = (arg: string): string | null => {
  try {
    return fileURLToPath(arg)
  } catch {
    return null
  }
}

const pathOf = (arg: string, cwd: string): string | null => {
  if (FILE_URL.test(arg)) return fromFileUrl(arg)
  if (arg.startsWith('-') || URL_SCHEME.test(arg)) return null
  return resolve(cwd, arg)
}

export const launchFileOf = (
  argv: readonly string[],
  cwd: string,
): string | null =>
  argv
    .slice(1)
    .map((arg) => pathOf(arg, cwd))
    .find((path): path is string => path !== null && isMarkdownPath(path)) ??
  null

export type LaunchQueue = {
  readonly offer: (argv: readonly string[], cwd: string) => boolean
  readonly take: () => Promise<string | null>
}

const NOTHING = Promise.resolve(null)

export const createLaunchQueue = ({
  realPath,
}: {
  readonly realPath: (path: string) => Promise<string>
}): LaunchQueue => {
  let pending: Promise<string | null> = NOTHING
  return {
    offer: (argv, cwd) => {
      const path = launchFileOf(argv, cwd)
      if (path === null) return false
      pending = realPath(path).catch(() => path)
      return true
    },
    take: () => {
      const current = pending
      pending = NOTHING
      return current
    },
  }
}
