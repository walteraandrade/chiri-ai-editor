import type { DirectoryEntry, SkillFileSystem } from './scan-skills'

export type FakeLink = { readonly link: string }
export type FakeDenied = { readonly denied: 'file' | 'directory' }
export type FakeDirectory = { readonly directory: true }
export type FakeSpecial = { readonly special: true }
export type FakeEntry =
  | string
  | FakeLink
  | FakeDenied
  | FakeDirectory
  | FakeSpecial

export type FakeTree = Readonly<Record<string, FakeEntry>>

type Node =
  | { readonly kind: 'file'; readonly text: string }
  | { readonly kind: 'denied-file' }
  | { readonly kind: 'directory' }
  | { readonly kind: 'special' }
  | { readonly kind: 'denied-directory' }
  | { readonly kind: 'symlink'; readonly target: string }

type Resolved = { readonly real: string; readonly node: Node }

const MAX_LINK_HOPS = 40

export const link = (target: string): FakeLink => ({ link: target })

export const deniedFile: FakeDenied = { denied: 'file' }

export const deniedDirectory: FakeDenied = { denied: 'directory' }

export const emptyDirectory: FakeDirectory = { directory: true }

export const special: FakeSpecial = { special: true }

const failure = (code: string, path: string): Error =>
  Object.assign(new Error(`${code}: ${path}`), { code })

const segmentsOf = (path: string): readonly string[] =>
  path
    .split('/')
    .filter((part) => part !== '' && part !== '.')
    .reduce<string[]>((kept, part) => {
      if (part === '..') kept.pop()
      else kept.push(part)
      return kept
    }, [])

const parentOf = (path: string): string =>
  `/${segmentsOf(path).slice(0, -1).join('/')}`

const nameOf = (path: string): string => segmentsOf(path).at(-1) ?? ''

const nodeOf = (entry: FakeEntry): Node => {
  if (typeof entry === 'string') return { kind: 'file', text: entry }
  if ('link' in entry) return { kind: 'symlink', target: entry.link }
  if ('denied' in entry)
    return entry.denied === 'file'
      ? { kind: 'denied-file' }
      : { kind: 'denied-directory' }
  if ('special' in entry) return { kind: 'special' }
  return { kind: 'directory' }
}

const ancestorsOf = (path: string): readonly string[] =>
  segmentsOf(path)
    .slice(0, -1)
    .map((_, index, parts) => `/${parts.slice(0, index + 1).join('/')}`)

const buildNodes = (tree: FakeTree): ReadonlyMap<string, Node> => {
  const explicit = Object.entries(tree).map(
    ([path, entry]) =>
      [`/${segmentsOf(path).join('/')}`, nodeOf(entry)] as const,
  )
  const implied = explicit
    .flatMap(([path]) => ancestorsOf(path))
    .map((path) => [path, { kind: 'directory' } as Node] as const)
  return new Map<string, Node>([
    ['/', { kind: 'directory' }],
    ...implied,
    ...explicit,
  ])
}

const kindOf = (node: Node): DirectoryEntry['kind'] =>
  node.kind === 'symlink'
    ? 'symlink'
    : node.kind === 'file' || node.kind === 'denied-file'
      ? 'file'
      : node.kind === 'special'
        ? 'other'
        : 'directory'

export const createFakeFileSystem = (tree: FakeTree): SkillFileSystem => {
  const nodes = buildNodes(tree)

  const resolveFrom = (
    real: string,
    rest: readonly string[],
    hops: number,
  ): Resolved => {
    if (hops > MAX_LINK_HOPS) throw failure('ELOOP', real)
    const [next, ...remaining] = rest
    if (next === undefined)
      return { real, node: nodes.get(real) ?? { kind: 'directory' } }
    const candidate = `${real === '/' ? '' : real}/${next}`
    const node = nodes.get(candidate)
    if (node === undefined) throw failure('ENOENT', candidate)
    if (node.kind !== 'symlink') return resolveFrom(candidate, remaining, hops)
    const base = node.target.startsWith('/') ? '/' : real
    return resolveFrom(
      '/',
      [...segmentsOf(`${base}/${node.target}`), ...remaining],
      hops + 1,
    )
  }

  const resolve = (path: string): Resolved =>
    resolveFrom('/', segmentsOf(path), 0)

  return {
    listDirectory: async (path): Promise<readonly DirectoryEntry[]> => {
      const { real, node } = resolve(path)
      if (node.kind === 'denied-directory') throw failure('EACCES', path)
      if (node.kind !== 'directory') throw failure('ENOTDIR', path)
      return [...nodes.entries()]
        .filter(([child]) => child !== real && parentOf(child) === real)
        .map(([child, childNode]) => ({
          name: nameOf(child),
          kind: kindOf(childNode),
        }))
        .reverse()
    },
    realPath: async (path) => resolve(path).real,
    readText: async (path) => {
      const { node } = resolve(path)
      if (node.kind === 'denied-file') throw failure('EACCES', path)
      if (node.kind !== 'file') throw failure('EISDIR', path)
      return node.text
    },
  }
}
