import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_NOT_FOUND_REASON } from '../../electron/api'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { DOCUMENT_STORAGE_KEY } from '../document/storage'
import { createElectronKit } from './electron-kit'
import {
  LAST_FILE_KEY,
  type RemovableStorage,
  UNSAVED_KEY_PREFIX,
} from './electron-storage'
import type { DocumentFiles, OpenResult } from './kit'

const PATH = '/skills/a/SKILL.md'

const createFakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  const storage: RemovableStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
  return { storage, entries: () => Object.fromEntries(data) }
}

const unsavedEntry = (path: string, text: string, base: string) => ({
  [`${UNSAVED_KEY_PREFIX}${path}`]: JSON.stringify({ text, base }),
})

const diskFile = (text: string, path = PATH): OpenResult<string> => ({
  kind: 'opened',
  file: { name: 'SKILL.md', text, ref: path },
})

const setup = (
  options: {
    readonly stored?: Record<string, string>
    readonly read?: DocumentFiles<string>['read']
  } = {},
) => {
  const { storage, entries } = createFakeStorage(options.stored)
  const flushStorage = vi.fn(async () => undefined)
  const hide: { flush: () => void } = { flush: () => undefined }
  const files: DocumentFiles<string> = {
    open: async () => ({ kind: 'cancelled' }),
    read: options.read ?? (async () => ({ kind: 'cancelled' })),
    save: async () => ({ kind: 'cancelled' }),
  }
  const kit = createElectronKit({
    storage,
    files,
    flushStorage,
    now: () => 1000,
    hasApiKey: true,
    onHide: (flush) => {
      hide.flush = flush
    },
  })
  return { kit, entries, flushStorage, hide, files }
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
    const { kit } = setup()
    const ready = await kit
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
      stored: {
        [LAST_FILE_KEY]: PATH,
        ...unsavedEntry(PATH, '# A, unsaved\n', '# A\n'),
      },
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
      stored: {
        [LAST_FILE_KEY]: PATH,
        ...unsavedEntry(PATH, '# A, mine\n', '# A\n'),
      },
      read: async () => diskFile('# A, by an agent\n'),
    }).kit
    expect(ready.unsavedText.initial).toBe('# A, mine\n')
    expect(ready.start).toMatchObject({
      savedText: '# A\n',
      diskChanged: true,
    })
  })

  it('falls back to the stored Document and says so when the last file is gone', async () => {
    const ready = await setup({
      stored: { [LAST_FILE_KEY]: PATH, [DOCUMENT_STORAGE_KEY]: '# Stored' },
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

  it('starts the History from the text it reopened', async () => {
    const { kit } = setup({
      stored: { [LAST_FILE_KEY]: PATH },
      read: async () => diskFile('# A\n'),
    })
    const ready = await kit
    expect(ready.history.snapshot().at(-1)?.text).toBe('# A\n')
  })
})

describe('createElectronKit when the last file is gone', () => {
  const gone = async (): Promise<OpenResult<string>> => ({
    kind: 'failed',
    reason: FILE_NOT_FOUND_REASON,
  })

  it('says so once: the last file is forgotten', async () => {
    const first = setup({
      stored: { [LAST_FILE_KEY]: PATH, [DOCUMENT_STORAGE_KEY]: '# Stored' },
      read: gone,
    })
    expect((await first.kit).notice).toBe(
      'Could not reopen SKILL.md: File not found',
    )
    expect(first.entries()[LAST_FILE_KEY]).toBeUndefined()
    const second = setup({ stored: first.entries(), read: gone })
    const ready = await second.kit
    expect(ready.notice).toBeNull()
    expect(ready.start).toBeNull()
    expect(ready.unsavedText.initial).toBe('# Stored')
  })

  it('drops the per-file unsaved text once the Document holds it', async () => {
    const { kit, entries } = setup({
      stored: {
        [LAST_FILE_KEY]: PATH,
        [DOCUMENT_STORAGE_KEY]: '# Stored, unsaved',
        ...unsavedEntry(PATH, '# Stored, unsaved', '# Stored'),
      },
      read: gone,
    })
    const ready = await kit
    expect(ready.unsavedText.initial).toBe('# Stored, unsaved')
    expect(entries()[`${UNSAVED_KEY_PREFIX}${PATH}`]).toBeUndefined()
  })

  it('keeps the per-file unsaved text when the Document is not that text', async () => {
    const { kit, entries } = setup({
      stored: {
        [LAST_FILE_KEY]: PATH,
        [DOCUMENT_STORAGE_KEY]: '# Something else',
        ...unsavedEntry(PATH, '# Stored, unsaved', '# Stored'),
      },
      read: gone,
    })
    await kit
    expect(entries()[`${UNSAVED_KEY_PREFIX}${PATH}`]).toBeDefined()
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
    const { kit, entries } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    expect(entries()[`${UNSAVED_KEY_PREFIX}${PATH}`]).toBeUndefined()
    vi.advanceTimersByTime(400)
    expect(
      JSON.parse(entries()[`${UNSAVED_KEY_PREFIX}${PATH}`] ?? 'null'),
    ).toEqual({ text: '# A, edited\n', base: '# A\n' })
  })

  it('asks the main process to write the storage to disk after keeping text', async () => {
    const { kit, flushStorage } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    vi.advanceTimersByTime(400)
    expect(flushStorage).toHaveBeenCalled()
  })

  it('forgets the unsaved text once the file holds it', async () => {
    const { kit, entries } = setup({
      stored: unsavedEntry(PATH, '# A, edited\n', '# A\n'),
    })
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', {
      ...session('# A, edited\n'),
      dirty: false,
    })
    vi.advanceTimersByTime(400)
    expect(entries()[`${UNSAVED_KEY_PREFIX}${PATH}`]).toBeUndefined()
  })

  it('still autosaves the Document, as the Web build does', async () => {
    const { kit, entries } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    vi.advanceTimersByTime(400)
    expect(entries()[DOCUMENT_STORAGE_KEY]).toBe('# A, edited\n')
  })

  it('keeps no per-file text without a file', async () => {
    const { kit, entries } = setup()
    const ready = await kit
    ready.unsavedText.changed('Untitled', null)
    vi.advanceTimersByTime(400)
    expect(
      Object.keys(entries()).filter((key) =>
        key.startsWith(UNSAVED_KEY_PREFIX),
      ),
    ).toEqual([])
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

  it('writes the pending unsaved text when the page hides', async () => {
    const { kit, entries, hide } = setup()
    const ready = await kit
    ready.unsavedText.changed('# A, edited\n', session('# A\n'))
    hide.flush()
    expect(entries()[`${UNSAVED_KEY_PREFIX}${PATH}`]).toBeDefined()
    expect(entries()[DOCUMENT_STORAGE_KEY]).toBe('# A, edited\n')
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

  it('reports the key status it was given', async () => {
    const ready = await setup().kit
    expect(ready.keyStatus.present).toBe(true)
  })
})
