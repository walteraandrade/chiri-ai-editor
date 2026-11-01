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
})
