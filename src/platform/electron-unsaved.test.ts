import { describe, expect, it, vi } from 'vitest'
import { createElectronUnsavedStore } from './electron-unsaved'

const createApi = () => ({
  unsavedLoad: vi.fn(async () => null as { text: string; base: string } | null),
  unsavedSave: vi.fn(async () => undefined),
  unsavedClear: vi.fn(async () => undefined),
})

const createStore = (api = createApi()) => {
  const report = { failed: vi.fn(), worked: vi.fn() }
  return { store: createElectronUnsavedStore(api, report), api, report }
}

describe('createElectronUnsavedStore', () => {
  it('loads the unsaved text of a path from the main process', async () => {
    const { store, api } = createStore()
    api.unsavedLoad.mockResolvedValueOnce({ text: 'typed', base: 'disk' })
    expect(await store.load('/a.md')).toEqual({ text: 'typed', base: 'disk' })
    expect(api.unsavedLoad).toHaveBeenCalledWith('/a.md')
  })

  it('returns nothing when the main process has nothing', async () => {
    const { store } = createStore()
    expect(await store.load('/a.md')).toBeNull()
  })

  it('lets a failed load reject', async () => {
    const { store, api } = createStore()
    const failure = new Error('db locked')
    api.unsavedLoad.mockRejectedValueOnce(failure)
    await expect(store.load('/a.md')).rejects.toBe(failure)
  })

  it('sends the unsaved text with its base as soon as it is kept', () => {
    const { store, api } = createStore()
    store.keep('/a.md', { text: 'typed', base: 'disk' })
    expect(api.unsavedSave).toHaveBeenCalledWith('/a.md', {
      text: 'typed',
      base: 'disk',
    })
  })

  it('clears the unsaved text as soon as it is dropped', () => {
    const { store, api } = createStore()
    store.drop('/a.md')
    expect(api.unsavedClear).toHaveBeenCalledWith('/a.md')
  })

  it('reports a write that went through', async () => {
    const { store, report } = createStore()
    store.keep('/a.md', { text: 'typed', base: 'disk' })
    store.drop('/a.md')
    await vi.waitFor(() => expect(report.worked).toHaveBeenCalledTimes(2))
    expect(report.failed).not.toHaveBeenCalled()
  })

  it('reports a failed keep or drop without throwing', async () => {
    const { store, api, report } = createStore()
    const failure = new Error('disk full')
    api.unsavedSave.mockRejectedValueOnce(failure)
    api.unsavedClear.mockRejectedValueOnce(failure)
    store.keep('/a.md', { text: 'typed', base: 'disk' })
    store.drop('/a.md')
    await vi.waitFor(() => expect(report.failed).toHaveBeenCalledTimes(2))
    expect(report.failed).toHaveBeenCalledWith(failure)
  })

  it('reports a write that throws before it is sent', async () => {
    const { store, api, report } = createStore()
    const failure = new Error('bridge gone')
    api.unsavedSave.mockImplementationOnce(() => {
      throw failure
    })
    store.keep('/a.md', { text: 'typed', base: 'disk' })
    await vi.waitFor(() => expect(report.failed).toHaveBeenCalledWith(failure))
  })
})
