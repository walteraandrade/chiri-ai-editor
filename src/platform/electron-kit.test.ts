import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_NOT_FOUND_REASON } from '../../electron/api'
import type { HistoryApi } from '../../electron/history-api'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import type { Unsaved } from '../document/unsaved'
import { createLocalHistoryStore } from '../history/local-store'
import type { HistoryStore } from '../history/store'
import { createElectronKit, SCRATCH_KEY } from './electron-kit'
import { LAST_FILE_KEY } from './electron-storage'
import type {
  DocumentFiles,
  ExternalKit,
  LaunchKit,
  LibraryKit,
  OpenResult,
} from './kit'

const PATH = '/skills/a/SKILL.md'
const OTHER = '/skills/b/SKILL.md'

const createFakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
      removeItem: (key: string) => {
        data.delete(key)
      },
    },
    entries: () => Object.fromEntries(data),
  }
}

const createFakeApi = (unsaved: Record<string, Unsaved> = {}) => {
  const kept = new Map(Object.entries(unsaved))
  const stores = new Map<string, HistoryStore>()
  const storeOf = (key: string): HistoryStore => {
    const known = stores.get(key)
    if (known) return known
    const created = createLocalHistoryStore(null)
    stores.set(key, created)
    return created
  }
  const api = {
    historyList: vi.fn((key: string) => storeOf(key).list(key)),
    historyText: vi.fn((key: string, id: number) => storeOf(key).text(key, id)),
    historyRecord: vi.fn(
      (key: string, input: Parameters<HistoryStore['record']>[1]) =>
        storeOf(key).record(key, input),
    ),
    historyMarkSaved: vi.fn(
      (key: string, input: Parameters<HistoryStore['markSaved']>[1]) =>
        storeOf(key).markSaved(key, input),
    ),
    unsavedLoad: vi.fn(async (key: string) => kept.get(key) ?? null),
    unsavedSave: vi.fn(async (key: string, value: Unsaved) => {
      kept.set(key, value)
    }),
    unsavedClear: vi.fn(async (key: string) => {
      kept.delete(key)
    }),
  } satisfies Pick<
    HistoryApi,
    | 'historyList'
    | 'historyText'
    | 'historyRecord'
    | 'historyMarkSaved'
    | 'unsavedLoad'
    | 'unsavedSave'
    | 'unsavedClear'
  >
  return { api, kept }
}

const diskFile = (text: string, path = PATH): OpenResult<string> => ({
  kind: 'opened',
  file: { name: 'SKILL.md', text, ref: path },
})

const fakeLibrary: LibraryKit<string> = {
  list: async () => ({ kind: 'listed', roots: [], problem: null }),
  addRoot: async () => ({ kind: 'cancelled' }),
  removeRoot: async () => ({ kind: 'removed' }),
  createSkill: async ({ root, name }) => ({
    kind: 'created',
    path: `${root}/${name}/SKILL.md`,
    name,
  }),
  toRef: (path) => path,
  folderNameOf: () => undefined,
  subscribe: () => () => undefined,
}

const fakeExternal: ExternalKit<string> = {
  watch: () => undefined,
  subscribe: () => () => undefined,
  readDisk: async () => ({ kind: 'gone' }),
}

const setup = (
  options: {
    readonly stored?: Record<string, string>
    readonly unsaved?: Record<string, Unsaved>
    readonly history?: Record<string, string>
    readonly failUnsavedLoad?: Error
    readonly read?: DocumentFiles<string>['read']
    readonly launched?: string
  } = {},
) => {
  const { storage, entries } = createFakeStorage(options.stored)
  const { api, kept } = createFakeApi(options.unsaved)
  for (const [key, text] of Object.entries(options.history ?? {}))
    void api.historyRecord(key, { at: 1, cause: { kind: 'edited' }, text })
  if (options.failUnsavedLoad)
    api.unsavedLoad.mockRejectedValueOnce(options.failUnsavedLoad)
  const hide: { flush: () => void } = { flush: () => undefined }
  const files: DocumentFiles<string> = {
    open: async () => ({ kind: 'cancelled' }),
    read: options.read ?? (async () => ({ kind: 'cancelled' })),
    save: async () => ({ kind: 'cancelled' }),
  }
  const launches: LaunchKit<string> = {
    take: async () => options.launched ?? null,
    subscribe: () => () => undefined,
  }
  const kit = createElectronKit({
    api,
    storage,
    files,
    library: fakeLibrary,
    external: fakeExternal,
    launches,
    preferencesRequests: () => () => undefined,
    now: () => 1000,
    hasApiKey: true,
    onHide: (flush) => {
      hide.flush = flush
    },
  })
  return { kit, api, kept, entries, hide, files, launches }
}

const session = (savedText: string, ref: string | null = PATH) => ({
  name: 'SKILL.md',
  ref,
  savedText,
  dirty: true,
})

describe('createElectronKit start', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts from the sample Document with no last file', async () => {
    const ready = await setup().kit
    expect(ready.unsavedText.initial).toBe(SAMPLE_DOCUMENT)
    expect(ready.start).toBeNull()
    expect(ready.notice).toBeNull()
  })

  it('reopens the last file from the disk', async () => {
    const read = vi.fn(async () => diskFile('# A\n'))
    const ready = await setup({ stored: { [LAST_FILE_KEY]: PATH }, read }).kit
    expect(read).toHaveBeenCalledWith(PATH)
    expect(ready.unsavedText.initial).toBe('# A\n')
    expect(ready.start).toEqual({
      name: 'SKILL.md',
      ref: PATH,
      savedText: '# A\n',
      diskChanged: false,
    })
    expect(ready.notice).toBeNull()
  })

  it('brings back the unsaved text of the last file', async () => {
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved: { [PATH]: { text: '# A, unsaved\n', base: '# A\n' } },
      read: async () => diskFile('# A\n'),
    }).kit
    expect(ready.unsavedText.initial).toBe('# A, unsaved\n')
    expect(ready.start).toMatchObject({
      savedText: '# A\n',
      diskChanged: false,
    })
    expect(ready.notice).toBe('Restored unsaved changes to SKILL.md')
  })

  it('marks the file as changed on disk when the unsaved text began from older text', async () => {
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved: { [PATH]: { text: '# A, mine\n', base: '# A\n' } },
      read: async () => diskFile('# A, by an agent\n'),
    }).kit
    expect(ready.unsavedText.initial).toBe('# A, mine\n')
    expect(ready.start).toMatchObject({
      savedText: '# A\n',
      diskChanged: true,
    })
  })

  it('starts from the unsaved Document when there is no last file', async () => {
    const ready = await setup({
      unsaved: { [SCRATCH_KEY]: { text: '# Typed, no file\n', base: '' } },
    }).kit
    expect(ready.unsavedText.initial).toBe('# Typed, no file\n')
    expect(ready.start).toBeNull()
  })

  it('measures an untitled Document against the sample, not against a restored draft', async () => {
    const restored = await setup({
      unsaved: { [SCRATCH_KEY]: { text: '# Typed, no file\n', base: '' } },
    }).kit
    expect(restored.unsavedText.untitledBaseline).toBe(SAMPLE_DOCUMENT)
    expect(restored.unsavedText.untitledBaseline).not.toBe(
      restored.unsavedText.initial,
    )
    const fresh = await setup().kit
    expect(fresh.unsavedText.untitledBaseline).toBe(fresh.unsavedText.initial)
  })

  it('falls back to the unsaved Document and says so when the last file is gone', async () => {
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved: { [SCRATCH_KEY]: { text: '# Stored', base: '' } },
      read: async () => ({ kind: 'failed', reason: 'File not found' }),
    }).kit
    expect(ready.unsavedText.initial).toBe('# Stored')
    expect(ready.start).toBeNull()
    expect(ready.notice).toBe('Could not reopen SKILL.md: File not found')
  })

  it('falls back when reading the last file throws', async () => {
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: async () => {
        throw new Error('IPC closed')
      },
    }).kit
    expect(ready.start).toBeNull()
    expect(ready.notice).toBe('Could not reopen SKILL.md')
  })

  it('does not start when the main process cannot give the unsaved Document', async () => {
    const { kit } = setup({ failUnsavedLoad: new Error('database is locked') })
    await expect(kit).rejects.toThrow('database is locked')
  })

  it('starts the History of the last file from the text it reopened', async () => {
    const { kit, api } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: async () => diskFile('# A\n'),
    })
    const ready = await kit
    expect(api.historyRecord).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({ text: '# A\n' }),
    )
    const [version] = ready.history.snapshot()
    expect(version?.cause.kind).toBe('started')
    expect(version && (await ready.history.text(version.id))).toBe('# A\n')
  })

  it('starts the History of a Document with no file under its own key', async () => {
    const { kit, api } = setup()
    await kit
    expect(api.historyRecord).toHaveBeenCalledWith(
      SCRATCH_KEY,
      expect.objectContaining({ text: SAMPLE_DOCUMENT }),
    )
  })

  it('records the unsaved text it restored as an Edited Version', async () => {
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved: { [PATH]: { text: '# A, unsaved\n', base: '# A\n' } },
      history: { [PATH]: '# A\n' },
      read: async () => diskFile('# A\n'),
    }).kit
    await ready.history.settled()
    expect(ready.history.snapshot().map(({ cause }) => cause.kind)).toEqual([
      'started',
      'edited',
    ])
  })
})

describe('createElectronKit launched with a file', () => {
  const LAUNCHED = '/notes/today.md'
  const byPath =
    (texts: Record<string, string>): DocumentFiles<string>['read'] =>
    async (path) =>
      texts[path] === undefined
        ? { kind: 'failed', reason: FILE_NOT_FOUND_REASON }
        : diskFile(texts[path], path)

  it('opens the launched file instead of the last file', async () => {
    const read = vi.fn(byPath({ [PATH]: '# Last\n', [LAUNCHED]: '# Today\n' }))
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read,
      launched: LAUNCHED,
    }).kit
    expect(read).toHaveBeenCalledExactlyOnceWith(LAUNCHED)
    expect(ready.unsavedText.initial).toBe('# Today\n')
    expect(ready.start?.ref).toBe(LAUNCHED)
    expect(ready.notice).toBeNull()
  })

  it('reopens the launched file at the next start', async () => {
    const { kit, entries } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: byPath({ [LAUNCHED]: '# Today\n' }),
      launched: LAUNCHED,
    })
    await kit
    expect(entries()[LAST_FILE_KEY]).toBe(LAUNCHED)
  })

  it('brings back the unsaved text of the launched file', async () => {
    const ready = await setup({
      unsaved: { [LAUNCHED]: { text: '# Today, edited', base: '# Today\n' } },
      read: byPath({ [LAUNCHED]: '# Today\n' }),
      launched: LAUNCHED,
    }).kit
    expect(ready.unsavedText.initial).toBe('# Today, edited')
    expect(ready.notice).toBe('Restored unsaved changes to SKILL.md')
  })

  it('says it could not open the launched file and reopens the last one', async () => {
    const { kit, entries } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: byPath({ [PATH]: '# Last\n' }),
      launched: LAUNCHED,
    })
    const ready = await kit
    expect(ready.notice).toBe('Could not open today.md: File not found')
    expect(ready.unsavedText.initial).toBe('# Last\n')
    expect(ready.start?.ref).toBe(PATH)
    expect(entries()[LAST_FILE_KEY]).toBe(PATH)
  })

  it('carries the launches it was given', async () => {
    const { kit, launches } = setup()
    expect((await kit).launches).toBe(launches)
  })
})

describe('createElectronKit when the last file is gone', () => {
  const gone = async (): Promise<OpenResult<string>> => ({
    kind: 'failed',
    reason: FILE_NOT_FOUND_REASON,
  })

  it('says so once: the last file is forgotten', async () => {
    const unsaved = { [SCRATCH_KEY]: { text: '# Stored', base: '' } }
    const first = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved,
      read: gone,
    })
    expect((await first.kit).notice).toBe(
      'Could not reopen SKILL.md: File not found',
    )
    expect(first.entries()[LAST_FILE_KEY]).toBeUndefined()
    const second = setup({ stored: first.entries(), unsaved, read: gone })
    const ready = await second.kit
    expect(ready.notice).toBeNull()
    expect(ready.start).toBeNull()
    expect(ready.unsavedText.initial).toBe('# Stored')
  })

  it('drops the per-file unsaved text once the Document holds it', async () => {
    const { kit, kept } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved: {
        [SCRATCH_KEY]: { text: '# Stored, unsaved', base: '' },
        [PATH]: { text: '# Stored, unsaved', base: '# Stored' },
      },
      read: gone,
    })
    const ready = await kit
    expect(ready.unsavedText.initial).toBe('# Stored, unsaved')
    expect(kept.has(PATH)).toBe(false)
  })

  it('keeps the per-file unsaved text when the Document is not that text', async () => {
    const { kit, kept } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      unsaved: {
        [SCRATCH_KEY]: { text: '# Something else', base: '' },
        [PATH]: { text: '# Stored, unsaved', base: '# Stored' },
      },
      read: gone,
    })
    await kit
    expect(kept.has(PATH)).toBe(true)
  })

  it('remembers the next file that gets opened', async () => {
    const { kit, entries } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: gone,
    })
    const ready = await kit
    ready.unsavedText.changed('# B\n', {
      name: 'B.md',
      ref: '/skills/b/B.md',
      savedText: '# B\n',
      dirty: false,
    })
    expect(entries()[LAST_FILE_KEY]).toBe('/skills/b/B.md')
  })

  it('remembers the same path again when it comes back', async () => {
    const { kit, entries } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: gone,
    })
    const ready = await kit
    expect(entries()[LAST_FILE_KEY]).toBeUndefined()
    ready.unsavedText.changed('# A\n', {
      name: 'SKILL.md',
      ref: PATH,
      savedText: '# A\n',
      dirty: false,
    })
    expect(entries()[LAST_FILE_KEY]).toBe(PATH)
  })

  it.each([
    [
      'a refused read',
      async (): Promise<OpenResult<string>> => ({
        kind: 'failed',
        reason: 'Permission denied',
      }),
    ],
    [
      'a read that throws',
      async (): Promise<OpenResult<string>> => {
        throw new Error('IPC closed')
      },
    ],
  ])('keeps the last file after %s, which may pass', async (_label, read) => {
    const { kit, entries } = setup({ stored: { [LAST_FILE_KEY]: PATH }, read })
    await kit
    expect(entries()[LAST_FILE_KEY]).toBe(PATH)
  })
})

describe('createElectronKit changes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps unsaved text under the real path after the delay, with the text it started from', async () => {
    const { kit, api } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    expect(api.unsavedSave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(api.unsavedSave).toHaveBeenCalledWith(PATH, {
      text: '# A, edited\n',
      base: '# A\n',
    })
  })

  it('forgets the unsaved text once the file holds it', async () => {
    const { kit, api, kept } = setup({
      unsaved: { [PATH]: { text: '# A, edited\n', base: '# A\n' } },
    })
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', {
      ...session('# A, edited\n'),
      dirty: false,
    })
    vi.advanceTimersByTime(400)
    expect(api.unsavedClear).toHaveBeenCalledWith(PATH)
    expect(kept.has(PATH)).toBe(false)
  })

  it('also keeps the Document under its own key, as the Web build autosaves it', async () => {
    const { kit, api } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    vi.advanceTimersByTime(400)
    expect(api.unsavedSave).toHaveBeenCalledWith(SCRATCH_KEY, {
      text: '# A, edited\n',
      base: '',
    })
  })

  it('keeps only the Document without a file', async () => {
    const { kit, api } = setup()
    const ready = await kit
    ready.unsavedText.changed('Untitled', null)
    vi.advanceTimersByTime(400)
    expect(api.unsavedSave.mock.calls.map(([key]) => key)).toEqual([
      SCRATCH_KEY,
    ])
  })

  it('remembers the file to reopen at the next start', async () => {
    const { kit, entries } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A\n', { ...session('# A\n'), dirty: false })
    expect(entries()[LAST_FILE_KEY]).toBe(PATH)
  })

  it('does not remember a download that has no path', async () => {
    const { kit, entries } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A\n', session('# A\n', null))
    expect(entries()[LAST_FILE_KEY]).toBeUndefined()
  })

  it('sends the pending unsaved text and History edits when the page hides', async () => {
    const { kit, api, hide } = setup()
    const ready = await kit
    api.historyRecord.mockClear()
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    ready.history.edited('# A, edited\n')
    hide.flush()
    expect(api.unsavedSave).toHaveBeenCalledWith(PATH, {
      text: '# A, edited\n',
      base: '# A\n',
    })
    expect(api.historyRecord).toHaveBeenCalledWith(
      SCRATCH_KEY,
      expect.objectContaining({ text: '# A, edited\n' }),
    )
  })

  it('offers the unsaved text of a file, pending text included', async () => {
    const { kit } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    expect(await ready.unsavedText.offered(PATH)).toEqual({
      text: '# A, edited\n',
      base: '# A\n',
    })
    expect(await ready.unsavedText.offered('/other.md')).toBeNull()
  })

  it('drops the unsaved text of a file on discard, pending text included', async () => {
    const { kit, kept } = setup({
      unsaved: { [PATH]: { text: '# A, old\n', base: '# A\n' } },
    })
    const ready = await kit
    ready.unsavedText.changed('# A, newer\n', session('# A\n'))
    ready.unsavedText.discard?.(PATH)
    vi.advanceTimersByTime(1000)
    expect(kept.has(PATH)).toBe(false)
    expect(await ready.unsavedText.offered(PATH)).toBeNull()
  })

  it('leaves the unsaved text of other files alone on discard', async () => {
    const { kit, kept } = setup({
      unsaved: { [OTHER]: { text: '# B, unsaved\n', base: '# B\n' } },
    })
    const ready = await kit
    ready.unsavedText.discard?.(PATH)
    expect(kept.has(OTHER)).toBe(true)
  })

  it('carries the Library it was given', async () => {
    const ready = await setup().kit
    expect(ready.library).toBe(fakeLibrary)
  })

  it('carries the change watcher it was given', async () => {
    const ready = await setup().kit
    expect(ready.external).toBe(fakeExternal)
  })

  it('reports the key status it was given', async () => {
    const ready = await setup().kit
    expect(ready.keyStatus.present).toBe(true)
  })
})

describe('createElectronKit History per file', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves the History to the file that opens, recording pending edits first', async () => {
    const { kit, api } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: async () => diskFile('# A\n'),
    })
    const ready = await kit
    api.historyRecord.mockClear()
    ready.history.edited('# A, typed\n')
    ready.history.select(OTHER)
    ready.history.opened({ text: '# B\n', name: 'SKILL.md' })
    await ready.history.settled()
    expect(
      api.historyRecord.mock.calls.map(([key, input]) => [key, input.text]),
    ).toEqual([
      [PATH, '# A, typed\n'],
      [OTHER, '# B\n'],
    ])
  })

  it('shows the Timeline of the file it moved to, and of the one it comes back to', async () => {
    const { kit } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: async () => diskFile('# A\n'),
    })
    const ready = await kit
    ready.history.select(OTHER)
    ready.history.opened({ text: '# B\n', name: 'SKILL.md' })
    await ready.history.settled()
    expect(ready.history.snapshot()).toHaveLength(1)
    ready.history.select(PATH)
    await ready.history.settled()
    expect(ready.history.snapshot()).toHaveLength(1)
    const [version] = ready.history.snapshot()
    expect(version && (await ready.history.text(version.id))).toBe('# A\n')
  })

  it('moves a Document with no file to the file it is saved as', async () => {
    const { kit, api } = setup()
    const ready = await kit
    api.historyMarkSaved.mockClear()
    ready.history.select(PATH)
    ready.history.saved({ text: SAMPLE_DOCUMENT, name: 'SKILL.md' })
    await ready.history.settled()
    expect(api.historyMarkSaved).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({ name: 'SKILL.md' }),
    )
    expect(ready.history.snapshot()).toMatchObject([
      { cause: { kind: 'started' }, saved: 'SKILL.md' },
    ])
  })
})

describe('createElectronKit failures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports failed unsaved writes once, however many fail', async () => {
    const { kit, api } = setup()
    const ready = await kit
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.unsavedSave.mockRejectedValue(new Error('db locked'))
    const heard = vi.fn()
    ready.problems.subscribe(heard)
    for (const text of ['# One', '# Two', '# Three']) {
      ready.unsavedText.changed(text, session('# A\n'))
      vi.advanceTimersByTime(400)
      await vi.advanceTimersByTimeAsync(0)
    }
    expect(heard).toHaveBeenCalledExactlyOnceWith('unsaved')
    log.mockRestore()
  })

  it('reports a failed History write', async () => {
    const { kit, api } = setup()
    const ready = await kit
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const heard = vi.fn()
    ready.problems.subscribe(heard)
    api.historyRecord.mockRejectedValueOnce(new Error('disk full'))
    ready.history.opened({ text: '# Opened', name: 'a.md' })
    await ready.history.settled()
    expect(heard).toHaveBeenCalledExactlyOnceWith('history')
    log.mockRestore()
  })
})
