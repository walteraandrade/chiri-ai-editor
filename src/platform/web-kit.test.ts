import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkdownFileHandle } from '../document/file-access'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { DOCUMENT_STORAGE_KEY, type StorageLike } from '../document/storage'
import { HISTORY_STORAGE_KEY } from '../history/storage'
import type { DocumentFiles } from './kit'
import { createWebKit, createWebKitFactory } from './web-kit'

const fakeFiles = (): DocumentFiles<MarkdownFileHandle> => ({
  open: async () => ({ kind: 'cancelled' }),
  read: async () => ({ kind: 'cancelled' }),
  save: async () => ({ kind: 'cancelled' }),
})

const createFakeStorage = (
  initial: Record<string, string> = {},
): StorageLike & { readonly entries: () => Record<string, string> } => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    entries: () => Object.fromEntries(data),
  }
}

const build = (
  storage: StorageLike | null,
  options: { readonly hasApiKey?: boolean } = {},
) => {
  const hide: { flush: () => void } = { flush: () => undefined }
  const files = fakeFiles()
  const kit = createWebKit({
    storage,
    files,
    now: () => 1000,
    hasApiKey: options.hasApiKey ?? true,
    onHide: (flush) => {
      hide.flush = flush
    },
  })
  return { kit, hide, files }
}

describe('createWebKit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts from the sample Document when nothing is stored', () => {
    const { kit } = build(createFakeStorage())
    expect(kit.unsavedText.initial).toBe(SAMPLE_DOCUMENT)
  })

  it('starts from the stored Document', () => {
    const { kit } = build(
      createFakeStorage({ [DOCUMENT_STORAGE_KEY]: '# Saved' }),
    )
    expect(kit.unsavedText.initial).toBe('# Saved')
  })

  it('starts without storage', () => {
    const { kit } = build(null)
    expect(kit.unsavedText.initial).toBe(SAMPLE_DOCUMENT)
  })

  it('saves the Document after the autosave delay', () => {
    const storage = createFakeStorage()
    const { kit } = build(storage)
    kit.unsavedText.changed('# Changed', null)
    expect(storage.entries()[DOCUMENT_STORAGE_KEY]).toBeUndefined()
    vi.advanceTimersByTime(400)
    expect(storage.entries()[DOCUMENT_STORAGE_KEY]).toBe('# Changed')
  })

  it('saves the Document and the History when the page hides', () => {
    const storage = createFakeStorage()
    const { kit, hide } = build(storage)
    kit.unsavedText.changed('# Changed', null)
    kit.history.edited('# Changed')
    hide.flush()
    expect(storage.entries()[DOCUMENT_STORAGE_KEY]).toBe('# Changed')
    expect(storage.entries()[HISTORY_STORAGE_KEY]).toContain('# Changed')
  })

  it('stores the first Version of a new History', () => {
    const storage = createFakeStorage()
    build(storage)
    expect(storage.entries()[HISTORY_STORAGE_KEY]).toContain('"kind":"started"')
  })

  it('hands over the files it was given', () => {
    const { kit, files } = build(null)
    expect(kit.files).toBe(files)
  })

  it('starts with no file, no notice and no unsaved text to offer', async () => {
    const { kit } = build(null)
    expect(kit.start).toBeNull()
    expect(kit.notice).toBeNull()
    expect(await kit.unsavedText.offered({} as MarkdownFileHandle)).toBeNull()
  })

  it('ignores the file when saving the Document: one autosave for the Web build', () => {
    const storage = createFakeStorage()
    const { kit } = build(storage)
    kit.unsavedText.changed('# Changed', {
      name: 'a.md',
      ref: null,
      savedText: '# A',
      dirty: true,
    })
    vi.advanceTimersByTime(400)
    expect(storage.entries()[DOCUMENT_STORAGE_KEY]).toBe('# Changed')
    expect(Object.keys(storage.entries()).sort()).toEqual([
      DOCUMENT_STORAGE_KEY,
      HISTORY_STORAGE_KEY,
    ])
  })

  it('reports the key status it was given', () => {
    expect(build(null, { hasApiKey: false }).kit.keyStatus.present).toBe(false)
    expect(build(null, { hasApiKey: true }).kit.keyStatus.present).toBe(true)
  })
})

describe('createWebKitFactory', () => {
  const deps = (storage: StorageLike | null, hasApiKey = true) => ({
    storage,
    files: fakeFiles(),
    now: () => 1000,
    hasApiKey,
    onHide: () => undefined,
  })

  it('resolves a kit with the values at the time it is called', async () => {
    const storage = createFakeStorage()
    const factory = createWebKitFactory(() => deps(storage))
    storage.setItem(DOCUMENT_STORAGE_KEY, '# Stored later')
    const kit = await factory()
    expect(kit.unsavedText.initial).toBe('# Stored later')
  })

  it('does not read anything before it is called', () => {
    const getDeps = vi.fn(() => deps(createFakeStorage()))
    createWebKitFactory(getDeps)
    expect(getDeps).not.toHaveBeenCalled()
  })

  it('resolves the key status it reads', async () => {
    const kit = await createWebKitFactory(() => deps(null, false))()
    expect(kit.keyStatus.present).toBe(false)
  })

  it('rejects when the values cannot be read', async () => {
    const failure = new Error('no storage')
    const factory = createWebKitFactory(() => {
      throw failure
    })
    await expect(factory()).rejects.toBe(failure)
  })
})
