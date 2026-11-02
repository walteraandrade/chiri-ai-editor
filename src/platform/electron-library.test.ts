import { describe, expect, it, vi } from 'vitest'
import type { LibraryListing } from '../skills/library'
import { createElectronLibrary, type LibraryApi } from './electron-library'

const ROOTS: LibraryListing = [
  {
    root: '/home/u/.claude/skills',
    label: '~/.claude/skills',
    removable: false,
    readable: true,
    skills: [],
  },
]

const api = (overrides: Partial<LibraryApi> = {}): LibraryApi => ({
  listLibrary: vi.fn(async () => ({ roots: ROOTS, problem: null })),
  addLibraryRoot: vi.fn(async () => ({
    kind: 'added' as const,
    label: '/repo/.claude/skills',
  })),
  removeLibraryRoot: vi.fn(async () => ({ kind: 'removed' as const })),
  onExternalChanges: vi.fn(() => () => undefined),
  createSkill: vi.fn(async ({ root, name }) => ({
    kind: 'created' as const,
    path: `${root}/${name}/SKILL.md`,
    name,
  })),
  ...overrides,
})

describe('createElectronLibrary', () => {
  it('lists the roots the main process scanned', async () => {
    expect(await createElectronLibrary(api()).list()).toEqual({
      kind: 'listed',
      roots: ROOTS,
      problem: null,
    })
  })

  it('passes on what the main process says is wrong with the root list', async () => {
    const library = createElectronLibrary(
      api({
        listLibrary: async () => ({
          roots: ROOTS,
          problem: 'Could not read library-roots.json',
        }),
      }),
    )
    expect(await library.list()).toEqual({
      kind: 'listed',
      roots: ROOTS,
      problem: 'Could not read library-roots.json',
    })
  })

  it('reports a failed list instead of throwing', async () => {
    const library = createElectronLibrary(
      api({
        listLibrary: async () => {
          throw new Error('IPC closed')
        },
      }),
    )
    expect(await library.list()).toEqual({ kind: 'failed' })
  })

  it('adds a root through the main process dialog', async () => {
    expect(await createElectronLibrary(api()).addRoot()).toEqual({
      kind: 'added',
      label: '/repo/.claude/skills',
    })
  })

  it('reports a failed add instead of throwing', async () => {
    const library = createElectronLibrary(
      api({
        addLibraryRoot: async () => {
          throw new Error('IPC closed')
        },
      }),
    )
    expect(await library.addRoot()).toEqual({
      kind: 'failed',
      reason: 'Could not reach the app',
    })
  })

  it('removes a root by its path', async () => {
    const calls = api()
    expect(
      await createElectronLibrary(calls).removeRoot('/repo/.claude/skills'),
    ).toEqual({ kind: 'removed' })
    expect(calls.removeLibraryRoot).toHaveBeenCalledWith('/repo/.claude/skills')
  })

  it('reports a failed remove instead of throwing', async () => {
    const library = createElectronLibrary(
      api({
        removeLibraryRoot: async () => {
          throw new Error('IPC closed')
        },
      }),
    )
    expect(await library.removeRoot('/x')).toEqual({
      kind: 'failed',
      reason: 'Could not reach the app',
    })
  })

  it('uses a real path as the ref of a file', () => {
    expect(createElectronLibrary(api()).toRef('/skills/a/SKILL.md')).toBe(
      '/skills/a/SKILL.md',
    )
  })

  it('tells listeners when a push says the Library may have changed, and not for other pushes', () => {
    let push: (changes: { paths: string[]; library: boolean }) => void = () =>
      undefined
    const library = createElectronLibrary(
      api({
        onExternalChanges: (listener) => {
          push = listener
          return () => undefined
        },
      }),
    )
    const listener = vi.fn()
    library.subscribe(listener)
    push({ paths: ['/skills/a/guide.md'], library: false })
    expect(listener).not.toHaveBeenCalled()
    push({ paths: ['/skills/b'], library: true })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('hands back the way to stop listening', () => {
    const stop = vi.fn()
    const library = createElectronLibrary(
      api({ onExternalChanges: () => stop }),
    )
    library.subscribe(() => undefined)()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('creates a skill through the main process with the root and the name', async () => {
    const calls = api()
    expect(
      await createElectronLibrary(calls).createSkill({
        root: '/home/u/.claude/skills',
        name: 'pdf',
      }),
    ).toEqual({
      kind: 'created',
      path: '/home/u/.claude/skills/pdf/SKILL.md',
      name: 'pdf',
    })
    expect(calls.createSkill).toHaveBeenCalledWith({
      root: '/home/u/.claude/skills',
      name: 'pdf',
    })
  })

  it('reports a failed create instead of throwing', async () => {
    const library = createElectronLibrary(
      api({
        createSkill: async () => {
          throw new Error('IPC closed')
        },
      }),
    )
    expect(await library.createSkill({ root: '/x', name: 'pdf' })).toEqual({
      kind: 'failed',
      reason: 'Could not reach the app',
    })
  })

  it('knows the folder of a file from its path', () => {
    const library = createElectronLibrary(api())
    expect(library.folderNameOf('/skills/pdf-tools/SKILL.md')).toBe('pdf-tools')
    expect(library.folderNameOf('/SKILL.md')).toBeUndefined()
    expect(library.folderNameOf('SKILL.md')).toBeUndefined()
  })
})
