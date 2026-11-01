import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { DOCUMENT_STORAGE_KEY, type StorageLike } from '../document/storage'
import { HISTORY_STORAGE_KEY } from '../history/storage'
import { createWebKit } from './web-kit'

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
  const kit = createWebKit({
    storage,
    now: () => 1000,
    hasApiKey: options.hasApiKey ?? true,
    onHide: (flush) => {
      hide.flush = flush
    },
  })
  return { kit, hide }
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
    kit.unsavedText.changed('# Changed')
    expect(storage.entries()[DOCUMENT_STORAGE_KEY]).toBeUndefined()
    vi.advanceTimersByTime(400)
    expect(storage.entries()[DOCUMENT_STORAGE_KEY]).toBe('# Changed')
  })

  it('saves the Document and the History when the page hides', () => {
    const storage = createFakeStorage()
    const { kit, hide } = build(storage)
    kit.unsavedText.changed('# Changed')
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

  it('reports the key status it was given', () => {
    expect(build(null, { hasApiKey: false }).kit.keyStatus.present).toBe(false)
    expect(build(null, { hasApiKey: true }).kit.keyStatus.present).toBe(true)
  })
})
