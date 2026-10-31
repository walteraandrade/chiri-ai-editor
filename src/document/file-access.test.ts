import { describe, expect, it, vi } from 'vitest'
import {
  type FileFallback,
  type FileHost,
  type MarkdownFileHandle,
  openMarkdownFile,
  saveMarkdownFile,
  supportsFileHandles,
} from './file-access'

const abortError = () => new DOMException('The user aborted.', 'AbortError')

const fakeHandle = (name: string, content = '', failWrite = false) => {
  const written: string[] = []
  const aborted: string[] = []
  const handle: MarkdownFileHandle = {
    name,
    getFile: async () => new File([content], name),
    createWritable: async () => {
      let pending = ''
      return {
        write: async (data: string) => {
          if (failWrite)
            throw new DOMException('Disk full.', 'QuotaExceededError')
          pending += data
        },
        close: async () => {
          written.push(pending)
        },
        abort: async () => {
          aborted.push(pending)
        },
      }
    },
  }
  return { handle, written, aborted }
}

const fakeFallback = (file: File | null = null) => {
  const downloads: { name: string; text: string }[] = []
  const fallback: FileFallback = {
    pickFile: vi.fn(async () => file),
    download: (name, text) => {
      downloads.push({ name, text })
    },
  }
  return { fallback, downloads }
}

const pickerHost = (
  open: FileHost['showOpenFilePicker'],
  save: FileHost['showSaveFilePicker'],
): FileHost => ({ showOpenFilePicker: open, showSaveFilePicker: save })

describe('supportsFileHandles', () => {
  it('needs both pickers', () => {
    const picker = vi.fn()
    expect(supportsFileHandles(pickerHost(picker, picker))).toBe(true)
    expect(supportsFileHandles({ showOpenFilePicker: picker })).toBe(false)
    expect(supportsFileHandles({})).toBe(false)
  })
})

describe('openMarkdownFile', () => {
  it('reads the picked file and keeps its handle', async () => {
    const { handle } = fakeHandle(
      'notes.md',
      `${String.fromCharCode(0xfeff)}# Notes\n`,
    )
    const open = vi.fn(async () => [handle])
    const { fallback } = fakeFallback()
    const opened = await openMarkdownFile(pickerHost(open, vi.fn()), fallback)
    expect(opened).toEqual({ name: 'notes.md', text: '# Notes\n', handle })
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: false }),
    )
    expect(fallback.pickFile).not.toHaveBeenCalled()
  })

  it('returns null when the picker is cancelled', async () => {
    const open = vi.fn(async () => {
      throw abortError()
    })
    const { fallback } = fakeFallback()
    expect(
      await openMarkdownFile(pickerHost(open, vi.fn()), fallback),
    ).toBeNull()
  })

  it('lets other picker errors through', async () => {
    const open = vi.fn(async () => {
      throw new DOMException('Not allowed.', 'NotAllowedError')
    })
    const { fallback } = fakeFallback()
    await expect(
      openMarkdownFile(pickerHost(open, vi.fn()), fallback),
    ).rejects.toThrow('Not allowed.')
  })

  it('uses the file input without the pickers', async () => {
    const { fallback } = fakeFallback(new File(['# Hi'], 'hi.md'))
    expect(await openMarkdownFile({}, fallback)).toEqual({
      name: 'hi.md',
      text: '# Hi',
      handle: null,
    })
  })

  it('returns null when the file input is cancelled', async () => {
    const { fallback } = fakeFallback(null)
    expect(await openMarkdownFile({}, fallback)).toBeNull()
  })
})

describe('saveMarkdownFile', () => {
  it('writes to the current handle without asking', async () => {
    const { handle, written } = fakeHandle('notes.md')
    const save = vi.fn()
    const { fallback } = fakeFallback()
    const saved = await saveMarkdownFile(pickerHost(vi.fn(), save), fallback, {
      text: 'New text',
      handle,
      name: 'notes.md',
      saveAs: false,
    })
    expect(saved).toEqual({ name: 'notes.md', handle, method: 'write' })
    expect(written).toEqual(['New text'])
    expect(save).not.toHaveBeenCalled()
  })

  it('asks for a file without a handle, suggesting the name', async () => {
    const { handle, written } = fakeHandle('picked.md')
    const save = vi.fn(async () => handle)
    const { fallback } = fakeFallback()
    const saved = await saveMarkdownFile(pickerHost(vi.fn(), save), fallback, {
      text: 'Text',
      handle: null,
      name: 'release-notes.md',
      saveAs: false,
    })
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'release-notes.md' }),
    )
    expect(saved).toEqual({ name: 'picked.md', handle, method: 'write' })
    expect(written).toEqual(['Text'])
  })

  it('asks for a new file on Save as, even with a handle', async () => {
    const current = fakeHandle('notes.md')
    const copy = fakeHandle('copy.md')
    const save = vi.fn(async () => copy.handle)
    const { fallback } = fakeFallback()
    const saved = await saveMarkdownFile(pickerHost(vi.fn(), save), fallback, {
      text: 'Text',
      handle: current.handle,
      name: 'notes.md',
      saveAs: true,
    })
    expect(saved?.handle).toBe(copy.handle)
    expect(current.written).toEqual([])
    expect(copy.written).toEqual(['Text'])
  })

  it('aborts the write and lets the error through when writing fails', async () => {
    const { handle, written, aborted } = fakeHandle('notes.md', '', true)
    const { fallback } = fakeFallback()
    await expect(
      saveMarkdownFile(pickerHost(vi.fn(), vi.fn()), fallback, {
        text: 'Text',
        handle,
        name: 'notes.md',
        saveAs: false,
      }),
    ).rejects.toThrow('Disk full.')
    expect(written).toEqual([])
    expect(aborted).toEqual([''])
  })

  it('returns null when the save picker is cancelled', async () => {
    const save = vi.fn(async () => {
      throw abortError()
    })
    const { fallback } = fakeFallback()
    expect(
      await saveMarkdownFile(pickerHost(vi.fn(), save), fallback, {
        text: 'Text',
        handle: null,
        name: 'notes.md',
        saveAs: false,
      }),
    ).toBeNull()
  })

  it('downloads a copy without the pickers', async () => {
    const { fallback, downloads } = fakeFallback()
    const saved = await saveMarkdownFile({}, fallback, {
      text: 'Text',
      handle: null,
      name: 'notes.md',
      saveAs: false,
    })
    expect(saved).toEqual({
      name: 'notes.md',
      handle: null,
      method: 'download',
    })
    expect(downloads).toEqual([{ name: 'notes.md', text: 'Text' }])
  })
})
