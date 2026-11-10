import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HASH = /^[0-9a-f]{7,40}$/

export const shortCommit = (output: string | null): string => {
  const hash = (output ?? '').trim()
  return HASH.test(hash) ? hash.slice(0, 7) : 'unknown'
}

const readText = (path: string): string | null =>
  existsSync(path) ? readFileSync(path, 'utf8').trim() : null

export const packedRef = (packed: string, ref: string): string | null =>
  packed
    .split('\n')
    .map((line) => line.split(' '))
    .find(([, name]) => name === ref)?.[0] ?? null

const gitDirOf = (root: string): string | null => {
  const dotGit = join(root, '.git')
  if (!existsSync(dotGit)) return null
  if (statSync(dotGit).isDirectory()) return dotGit
  const pointer = readText(dotGit)?.match(/^gitdir: (.+)$/)?.[1]
  return pointer === undefined ? null : resolve(root, pointer)
}

const gitHead = (root = process.cwd()): string | null => {
  const gitDir = gitDirOf(root)
  if (gitDir === null) return null
  const head = readText(join(gitDir, 'HEAD'))
  const ref = head?.match(/^ref: (.+)$/)?.[1]
  if (ref === undefined) return head
  const common = readText(join(gitDir, 'commondir'))
  const refsDir = common === null ? gitDir : resolve(gitDir, common)
  return (
    readText(join(refsDir, ref)) ??
    packedRef(readText(join(refsDir, 'packed-refs')) ?? '', ref)
  )
}

const packageVersion = (): string => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
  return typeof version === 'string' ? version : 'unknown'
}

export const buildInfo = () => ({
  version: packageVersion(),
  commit: shortCommit(gitHead()),
})
