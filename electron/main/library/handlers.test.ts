import { describe, expect, it, vi } from 'vitest'
import {
  createFakeFileSystem,
  type FakeTree,
  link,
} from '../../../src/skills/fake-file-system'
import {
  addLibraryRoot,
  type LibraryDeps,
  listLibrary,
  removeLibraryRoot,
} from './handlers'
import type { RootsStore } from './roots-store'

const HOME = '/home/u'
const CLAUDE = `${HOME}/.claude/skills`
const AGENTS = `${HOME}/.agents/skills`
const PROJECT = '/work/repo/.claude/skills'

const skillText = (name: string): string =>
  `---\nname: ${name}\ndescription: About ${name}.\n---\n`

const memoryStore = (initial: readonly string[] = []) => {
  let roots = initial
  const store: RootsStore = {
    load: async () => roots,
    save: async (next) => {
      roots = next
    },
  }
  return { store, current: () => roots }
}

const depsFor = (tree: FakeTree, store: RootsStore): LibraryDeps => ({
  home: HOME,
  store,
  fileSystem: createFakeFileSystem(tree),
})

const TREE: FakeTree = {
  [`${CLAUDE}/pdf/SKILL.md`]: skillText('pdf'),
  [`${CLAUDE}/shared`]: link(`${AGENTS}/shared`),
  [`${AGENTS}/shared/SKILL.md`]: skillText('shared'),
  [`${PROJECT}/local/SKILL.md`]: skillText('local'),
  '/work/plain/notes.md': '# notes\n',
}

describe('listLibrary', () => {
  it('lists the default roots first, then the project roots, with labels', async () => {
    const { store } = memoryStore([PROJECT])
    const roots = await listLibrary(depsFor(TREE, store))
    expect(
      roots.map(({ root, label, removable }) => ({ root, label, removable })),
    ).toEqual([
      { root: CLAUDE, label: '~/.claude/skills', removable: false },
      { root: AGENTS, label: '~/.agents/skills', removable: false },
      { root: PROJECT, label: PROJECT, removable: true },
    ])
  })

  it('shows a skill once, under the first root that reaches it', async () => {
    const { store } = memoryStore()
    const roots = await listLibrary(depsFor(TREE, store))
    expect(roots[0]?.skills.map((skill) => skill.name)).toEqual([
      'pdf',
      'shared',
    ])
    expect(roots[1]?.skills).toEqual([])
  })

  it('keeps an unreadable root in the list, marked', async () => {
    const { store } = memoryStore(['/work/missing'])
    const roots = await listLibrary(depsFor(TREE, store))
    expect(roots.at(-1)).toMatchObject({
      root: '/work/missing',
      readable: false,
      skills: [],
    })
  })
})

describe('addLibraryRoot', () => {
  it('adds the folder the dialog returns and keeps it', async () => {
    const { store, current } = memoryStore()
    const result = await addLibraryRoot(
      depsFor(TREE, store),
      async () => PROJECT,
    )
    expect(result).toEqual({ kind: 'added', label: PROJECT })
    expect(current()).toEqual([PROJECT])
  })

  it('keeps the real path of a folder reached through a link', async () => {
    const { store, current } = memoryStore()
    const tree: FakeTree = { ...TREE, '/work/alias': link(PROJECT) }
    expect(
      await addLibraryRoot(depsFor(tree, store), async () => '/work/alias'),
    ).toEqual({ kind: 'added', label: PROJECT })
    expect(current()).toEqual([PROJECT])
  })

  it('is cancelled when the dialog is', async () => {
    const { store, current } = memoryStore()
    expect(
      await addLibraryRoot(depsFor(TREE, store), async () => null),
    ).toEqual({ kind: 'cancelled' })
    expect(current()).toEqual([])
  })

  it('does not add a default root again', async () => {
    const { store, current } = memoryStore()
    expect(
      await addLibraryRoot(depsFor(TREE, store), async () => CLAUDE),
    ).toEqual({ kind: 'duplicate', label: '~/.claude/skills' })
    expect(current()).toEqual([])
  })

  it('does not add a root twice, even through a link', async () => {
    const { store, current } = memoryStore([PROJECT])
    const tree: FakeTree = { ...TREE, '/work/alias': link(PROJECT) }
    expect(
      await addLibraryRoot(depsFor(tree, store), async () => '/work/alias'),
    ).toMatchObject({ kind: 'duplicate' })
    expect(current()).toEqual([PROJECT])
  })

  it.each([
    ['a file', '/work/plain/notes.md'],
    ['a folder that is not there', '/work/missing'],
  ])('refuses %s', async (_name, path) => {
    const { store, current } = memoryStore()
    expect(
      await addLibraryRoot(depsFor(TREE, store), async () => path),
    ).toEqual({ kind: 'failed', reason: 'Not a readable folder' })
    expect(current()).toEqual([])
  })

  it.each([
    ['a relative path', 'skills'],
    ['a path with a NUL', '/work/a\0b'],
  ])('refuses %s from the dialog', async (_name, path) => {
    const { store } = memoryStore()
    expect(
      await addLibraryRoot(depsFor(TREE, store), async () => path),
    ).toEqual({ kind: 'failed', reason: 'Invalid request' })
  })

  it('fails when the roots cannot be kept', async () => {
    const store: RootsStore = {
      load: async () => [],
      save: vi.fn().mockRejectedValue(new Error('EACCES')),
    }
    expect(
      await addLibraryRoot(depsFor(TREE, store), async () => PROJECT),
    ).toEqual({ kind: 'failed', reason: 'Could not keep the roots' })
  })
})

describe('removeLibraryRoot', () => {
  it('removes a project root', async () => {
    const { store, current } = memoryStore([PROJECT, '/other'])
    expect(await removeLibraryRoot(depsFor(TREE, store), PROJECT)).toEqual({
      kind: 'removed',
    })
    expect(current()).toEqual(['/other'])
  })

  it('refuses a default root', async () => {
    const { store } = memoryStore([PROJECT])
    expect(await removeLibraryRoot(depsFor(TREE, store), CLAUDE)).toEqual({
      kind: 'failed',
      reason: 'Not a project root',
    })
  })

  it.each([
    ['a relative path', 'skills'],
    ['a non-string', { path: PROJECT }],
    ['nothing', undefined],
    ['a path with a NUL', '/work/a\0b'],
  ])('refuses %s', async (_name, input) => {
    const { store, current } = memoryStore([PROJECT])
    expect(await removeLibraryRoot(depsFor(TREE, store), input)).toEqual({
      kind: 'failed',
      reason: 'Invalid request',
    })
    expect(current()).toEqual([PROJECT])
  })
})
