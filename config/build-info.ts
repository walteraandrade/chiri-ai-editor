import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const HASH = /^[0-9a-f]{7,40}$/

export const shortCommit = (output: string | null): string => {
  const hash = (output ?? '').trim()
  return HASH.test(hash) ? hash.slice(0, 7) : 'unknown'
}

const gitHead = (): string | null => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

const packageVersion = (): string => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
  return typeof version === 'string' ? version : 'unknown'
}

export const buildInfo = () => ({
  version: packageVersion(),
  commit: shortCommit(gitHead()),
})
