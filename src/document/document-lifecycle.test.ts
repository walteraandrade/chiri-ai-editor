import { describe, expect, it, vi } from 'vitest'
import { createSwitchableHistory } from '../history/hub'
import { createLocalHistoryStore } from '../history/local-store'
import { createDocumentHistory } from '../history/session'
import type { HistoryStore } from '../history/store'
import type {
  DiskRead,
  DocumentFiles,
  ExternalChange,
  OpenResult,
  SaveResult,
  StartFile,
  UnsavedText,
} from '../platform/kit'
import { createDocumentLifecycle } from './document-lifecycle'
import type { LeaveChoice } from './leave-guard'

const KEY_A = '/notes/a.md'
const KEY_B = '/notes/b.md'

const opened = (
  text: string,
  name: string,
  ref: string,
): OpenResult<string> => ({
  kind: 'opened',
  file: { name, text, ref },
})

const createStores = () => {
  const stores = new Map<string, HistoryStore>()
  const at = (key: string): HistoryStore => {
    const known = stores.get(key)
    if (known) return known
    const created = createLocalHistoryStore(null)
    stores.set(key, created)
    return created
  }
  const store: HistoryStore = {
    list: (key) => at(key).list(key),
    text: (key, id) => at(key).text(key, id),
    record: (key, input) => at(key).record(key, input),
    markSaved: (key, input) => at(key).markSaved(key, input),
  }
  return store
}

const fakeEditor = (initial: string) => {
  let text = initial
  return {
    text: () => text,
    replace: vi.fn((next: string) => {
      text = next
    }),
    refresh: vi.fn((next: string) => {
      text = next
    }),
    restore: vi.fn((next: string) => {
      text = next
    }),
    type: (next: string) => {
      text = next
    },
  }
}

const fakeExternal = (disk: DiskRead) => {
  let listener: ((change: ExternalChange<string>) => void) | null = null
  const unsubscribe = vi.fn()
  return {
    watch: vi.fn(),
    subscribe: vi.fn((next: (change: ExternalChange<string>) => void) => {
      listener = next
      return unsubscribe
    }),
    readDisk: vi.fn(async () => disk),
    unsubscribe,
    emit: (touched: string) =>
      listener?.({ touches: (ref: string) => ref === touched }),
  }
}

type Setup = {
  readonly start?: StartFile<string> | null
  readonly editorText?: string
  readonly read?: (ref: string) => Promise<OpenResult<string>>
  readonly open?: () => Promise<OpenResult<string>>
  readonly save?: DocumentFiles<string>['save']
  readonly choice?: LeaveChoice
  readonly seeds?: Readonly<Record<string, string>>
  readonly disk?: DiskRead
  readonly detached?: boolean
}

const setup = async ({
  start = null,
  editorText = '',
  read = async () => ({ kind: 'cancelled' }),
  open = async () => ({ kind: 'cancelled' }),
  save = async () => ({ kind: 'cancelled' }),
  choice,
  seeds = {},
  disk,
  detached = false,
}: Setup = {}) => {
  const store = createStores()
  const history = createSwitchableHistory<string>({
    keyOf: (ref) => ref ?? 'scratch',
    create: (key, initial) =>
      createDocumentHistory({
        store,
        key,
        initial,
        now: () => 1000,
        idleMs: 30_000,
        onError: vi.fn(),
      }),
    first: { ref: start?.ref ?? null, initial: [] },
  })
  const editor = fakeEditor(editorText)
  const seed = (key: string, text: string) =>
    store.record(key, { at: 1, cause: { kind: 'edited' }, text })
  await seed(KEY_A, seeds[KEY_A] ?? 'A saved')
  await seed(KEY_B, seeds[KEY_B] ?? 'B old')
  await seed('scratch', seeds.scratch ?? editorText)
  const files: DocumentFiles<string> = { open, read, save }
  const changed = vi.fn()
  const discard = vi.fn()
  const unsavedText: UnsavedText<string> = {
    initial: editorText,
    untitledBaseline: '',
    changed,
    offered: async () => null,
    ...(choice !== undefined && { discard }),
  }
  const external = disk === undefined ? undefined : fakeExternal(disk)
  const notices: string[] = []
  const onReplaced = vi.fn()
  const lifecycle = createDocumentLifecycle<string>({
    files,
    unsavedText,
    history,
    start,
    ...(external !== undefined && { external }),
    editor: () => (detached ? null : editor),
    notify: (text) => notices.push(text),
    askLeave: async () => choice ?? 'cancel',
    onReplaced,
  })
  const log = async (key: string) => {
    await history.settled()
    const listed = await store.list(key)
    return Promise.all(
      listed.map(
        async (version) =>
          `${version.cause.kind}: ${await store.text(key, version.id)}${
            version.saved === undefined ? '' : ` [saved ${version.saved}]`
          }${version.cause.kind === 'restored' ? ` [from ${version.cause.from}]` : ''}`,
      ),
    )
  }
  return {
    lifecycle,
    history,
    editor,
    notices,
    onReplaced,
    log,
    changed,
    discard,
    external,
  }
}

const fileA: StartFile<string> = {
  name: 'a.md',
  ref: KEY_A,
  savedText: 'A saved',
  diskChanged: false,
}

describe('open', () => {
  it('settles the previous file text in its own History, then records Opened in the new one', async () => {
    const { lifecycle, editor, onReplaced, log } = await setup({
      start: fileA,
      editorText: 'A saved',
      open: async () => opened('B body', 'b.md', KEY_B),
    })
    editor.type('A edited')

    await lifecycle.open()

    expect(editor.replace).toHaveBeenCalledWith('B body')
    expect(await log(KEY_A)).toEqual(['started: A saved', 'edited: A edited'])
    expect(await log(KEY_B)).toEqual(['started: B old', 'opened: B body'])
    expect(lifecycle.snapshot().session?.ref).toBe(KEY_B)
    expect(onReplaced).toHaveBeenCalledTimes(1)
  })

  it('leaves everything alone when the leave guard says stay', async () => {
    const { lifecycle, history, editor, onReplaced, log } = await setup({
      start: fileA,
      editorText: 'A saved',
      open: async () => opened('B body', 'b.md', KEY_B),
      choice: 'cancel',
    })
    editor.type('A edited')
    lifecycle.edited('A edited')
    history.edited('A edited')

    await lifecycle.open()

    expect(editor.replace).not.toHaveBeenCalled()
    expect(await log(KEY_A)).toEqual(['started: A saved'])
    expect(await log(KEY_B)).toEqual(['started: B old'])
    expect(lifecycle.snapshot().session?.ref).toBe(KEY_A)
    expect(onReplaced).not.toHaveBeenCalled()
  })

  it('does not settle the old text when it matches the new text', async () => {
    const { lifecycle, log } = await setup({
      start: fileA,
      editorText: 'Same.',
      read: async () => opened('Same.', 'b.md', KEY_B),
    })

    await lifecycle.openRef(KEY_B)

    expect(await log(KEY_A)).toEqual(['started: A saved'])
    expect(await log(KEY_B)).toEqual(['started: B old', 'opened: Same.'])
  })
})

describe('reload from disk', () => {
  it('records the text you had as Edited, then the disk text as External', async () => {
    const { lifecycle, editor, onReplaced, log } = await setup({
      start: { ...fileA, diskChanged: true },
      editorText: 'mine',
      read: async () => opened('from disk', 'a.md', KEY_A),
    })
    expect(lifecycle.snapshot().conflict).toEqual({ name: 'a.md', ref: KEY_A })

    lifecycle.resolveConflict('reload')
    await vi.waitFor(() => expect(editor.text()).toBe('from disk'))

    expect(await log(KEY_A)).toEqual([
      'started: A saved',
      'edited: mine',
      'external: from disk',
    ])
    expect(lifecycle.snapshot().conflict).toBeNull()
    expect(onReplaced).toHaveBeenCalledTimes(1)
  })

  it('keeping yours clears the conflict and touches nothing', async () => {
    const { lifecycle, editor, log } = await setup({
      start: { ...fileA, diskChanged: true },
      editorText: 'mine',
    })

    lifecycle.resolveConflict('keep')

    expect(lifecycle.snapshot().conflict).toBeNull()
    expect(editor.text()).toBe('mine')
    expect(await log(KEY_A)).toEqual(['started: A saved'])
  })
})

describe('restore', () => {
  it('records the current text as Edited, then the Version as Restored', async () => {
    const { lifecycle, editor, onReplaced, log } = await setup({
      editorText: 'Now.',
      seeds: { scratch: 'Seed.' },
    })

    expect(lifecycle.restore(3, 'Old.')).toBe(true)

    expect(editor.restore).toHaveBeenCalledWith('Old.')
    expect(await log('scratch')).toEqual([
      'started: Seed.',
      'edited: Now.',
      'restored: Old. [from 3]',
    ])
    expect(onReplaced).toHaveBeenCalledTimes(1)
  })

  it('does nothing without an editor', async () => {
    const { lifecycle, onReplaced, log } = await setup({
      editorText: 'Now.',
      detached: true,
    })

    expect(lifecycle.restore(3, 'Old.')).toBe(false)

    expect(await log('scratch')).toEqual(['started: Now.'])
    expect(onReplaced).not.toHaveBeenCalled()
  })
})

describe('save', () => {
  it('marks the Version saved under the file name', async () => {
    const { lifecycle, history, editor, onReplaced, log } = await setup({
      start: fileA,
      editorText: 'A saved',
      save: async () => ({
        kind: 'saved',
        name: 'a.md',
        ref: KEY_A,
        method: 'write',
      }),
    })
    editor.type('A v2')
    history.edited('A v2')

    expect(await lifecycle.save(false)).toBe(true)

    expect(await log(KEY_A)).toEqual([
      'started: A saved',
      'edited: A v2 [saved a.md]',
    ])
    expect(lifecycle.snapshot().session?.dirty).toBe(false)
    expect(onReplaced).not.toHaveBeenCalled()
  })

  it('shows the conflict and records nothing when the disk moved on', async () => {
    const conflict: SaveResult<string> = { kind: 'conflict' }
    const { lifecycle, editor, log } = await setup({
      start: fileA,
      editorText: 'A saved',
      save: async () => conflict,
    })
    editor.type('A v2')

    expect(await lifecycle.save(false)).toBe(false)

    expect(lifecycle.snapshot().conflict).toEqual({ name: 'a.md', ref: KEY_A })
    expect(await log(KEY_A)).toEqual(['started: A saved', 'edited: A v2'])
  })
})

describe('leave guard', () => {
  const dirtyOpen = async (choice: LeaveChoice) => {
    const save = vi.fn(
      async (): Promise<SaveResult<string>> => ({
        kind: 'saved',
        name: 'a.md',
        ref: KEY_A,
        method: 'write',
      }),
    )
    const ctx = await setup({
      start: fileA,
      editorText: 'A saved',
      open: async () => opened('B body', 'b.md', KEY_B),
      save,
      choice,
    })
    ctx.editor.type('A edited')
    ctx.lifecycle.edited('A edited')
    await ctx.lifecycle.open()
    return { ...ctx, save }
  }

  it('discard throws the unsaved text away and opens the file', async () => {
    const { discard, editor, save } = await dirtyOpen('discard')

    expect(discard).toHaveBeenCalledWith(KEY_A)
    expect(save).not.toHaveBeenCalled()
    expect(editor.replace).toHaveBeenCalledWith('B body')
  })

  it('save writes the file first, then opens the other one', async () => {
    const { discard, editor, save } = await dirtyOpen('save')

    expect(save).toHaveBeenCalledTimes(1)
    expect(discard).not.toHaveBeenCalled()
    expect(editor.replace).toHaveBeenCalledWith('B body')
  })
})

describe('unsaved text', () => {
  it('is announced after an edit, an open and a save', async () => {
    const { lifecycle, editor, changed } = await setup({
      start: fileA,
      editorText: 'A saved',
      open: async () => opened('B body', 'b.md', KEY_B),
      save: async () => ({
        kind: 'saved',
        name: 'b.md',
        ref: KEY_B,
        method: 'write',
      }),
    })

    editor.type('A edited')
    lifecycle.edited('A edited')
    expect(changed).toHaveBeenLastCalledWith(
      'A edited',
      expect.objectContaining({ ref: KEY_A, dirty: true }),
    )

    await lifecycle.open()
    expect(changed).toHaveBeenLastCalledWith(
      'B body',
      expect.objectContaining({ ref: KEY_B, dirty: false }),
    )

    changed.mockClear()
    await lifecycle.save(false)
    expect(changed).toHaveBeenCalledTimes(1)
  })
})

describe('watchDisk', () => {
  const quiet = (disk: DiskRead, editorText = 'A saved') =>
    setup({
      start: fileA,
      editorText,
      disk,
      seeds: { [KEY_A]: 'A older' },
    })

  it('watches the open file and watches again when the file changes', async () => {
    const { lifecycle, external } = await setup({
      start: fileA,
      editorText: 'A saved',
      disk: { kind: 'text', name: 'a.md', text: 'A saved' },
      open: async () => opened('B body', 'b.md', KEY_B),
    })

    lifecycle.watchDisk()
    expect(external?.watch).toHaveBeenLastCalledWith(KEY_A)

    await lifecycle.open()
    expect(external?.watch).toHaveBeenLastCalledWith(KEY_B)
  })

  it('reloads silently when the disk changed and records Edited, then External', async () => {
    const { lifecycle, editor, external, onReplaced, notices, log } =
      await quiet({ kind: 'text', name: 'a.md', text: 'on disk' })
    lifecycle.watchDisk()
    editor.type('A saved')

    external?.emit(KEY_A)
    await vi.waitFor(() => expect(editor.text()).toBe('on disk'))

    expect(await log(KEY_A)).toEqual([
      'started: A older',
      'edited: A saved',
      'external: on disk',
    ])
    expect(notices).toEqual(['Reloaded a.md: it changed on disk'])
    expect(onReplaced).toHaveBeenCalledTimes(1)
    expect(lifecycle.snapshot().session?.savedText).toBe('on disk')
  })

  it('shows the conflict when you have unsaved text and the disk moved on', async () => {
    const { lifecycle, editor, external, log } = await quiet({
      kind: 'text',
      name: 'a.md',
      text: 'on disk',
    })
    lifecycle.watchDisk()
    editor.type('mine')

    external?.emit(KEY_A)
    await vi.waitFor(() =>
      expect(lifecycle.snapshot().conflict).toEqual({
        name: 'a.md',
        ref: KEY_A,
      }),
    )

    expect(editor.text()).toBe('mine')
    expect(await log(KEY_A)).toEqual(['started: A older'])
  })

  it('ignores changes to other files and stops listening on cleanup', async () => {
    const { lifecycle, external } = await quiet({
      kind: 'text',
      name: 'a.md',
      text: 'on disk',
    })
    const stop = lifecycle.watchDisk()

    external?.emit(KEY_B)
    await Promise.resolve()
    expect(external?.readDisk).not.toHaveBeenCalled()

    stop()
    expect(external?.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
