import { describe, expect, it, vi } from 'vitest'
import type { FileFallback, FileHost, MarkdownFileHandle } from './file-access'
import { createWebFiles } from './web-files'

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const fakeHandle = (name: string, content = '', failWrite = false) => {
  const written: string[] = []
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
        abort: async () => undefined,
      }
    },
  }
  return { handle, written }
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

const pickers = (
  open: FileHost['showOpenFilePicker'] = vi.fn(),
  save: FileHost['showSaveFilePicker'] = vi.fn(),
): FileHost => ({ showOpenFilePicker: open, showSaveFilePicker: save })

const build = (host: FileHost, file: File | null = null) => {
  const { fallback, downloads } = fakeFallback(file)
  return {
    files: createWebFiles({ host: () => host, fallback }),
    fallback,
    downloads,
  }
}

const request = (
  overrides: Partial<
    Parameters<ReturnType<typeof build>['files']['save']>[0]
  > = {},
) => ({
  text: '# Notes\n',
  ref: null,
  name: 'notes.md',
  expected: null,
  saveAs: false,
  ...overrides,
})

const abortError = () => new DOMException('The user aborted.', 'AbortError')

describe('open', () => {
  it('returns the picked file with its handle as the ref', async () => {
    const { handle } = fakeHandle('notes.md', '# Notes\r\n')
    const { files } = build(pickers(async () => [handle]))
    expect(await files.open()).toEqual({
      kind: 'opened',
      file: { name: 'notes.md', text: '# Notes\n', ref: handle },
    })
  })

  it('is cancelled when the picker is', async () => {
    const { files } = build(
      pickers(async () => {
        throw abortError()
      }),
    )
    expect(await files.open()).toEqual({ kind: 'cancelled' })
  })

  it('fails when the picker is refused', async () => {
    const { files } = build(
      pickers(async () => {
        throw new DOMException('Denied.', 'NotAllowedError')
      }),
    )
    expect(await files.open()).toEqual({ kind: 'failed' })
  })

  it('uses the file input without the pickers, with no ref', async () => {
    const { files } = build({}, new File(['# Hi'], 'hi.md'))
    expect(await files.open()).toEqual({
      kind: 'opened',
      file: { name: 'hi.md', text: '# Hi', ref: null },
    })
  })

  it('is cancelled when the file input is', async () => {
    const { files } = build({}, null)
    expect(await files.open()).toEqual({ kind: 'cancelled' })
  })
})

describe('read', () => {
  it('reads the file behind a handle again', async () => {
    const { handle } = fakeHandle('notes.md', '# Changed\n')
    const { files } = build(pickers())
    expect(await files.read(handle)).toEqual({
      kind: 'opened',
      file: { name: 'notes.md', text: '# Changed\n', ref: handle },
    })
  })

  it('fails when the handle can no longer be read', async () => {
    const handle: MarkdownFileHandle = {
      name: 'gone.md',
      getFile: async () => {
        throw new DOMException('Gone.', 'NotFoundError')
      },
      createWritable: vi.fn(),
    }
    const { files } = build(pickers())
    expect(await files.read(handle)).toEqual({ kind: 'failed' })
  })
})

describe('save', () => {
  it('writes to the handle it has, without asking', async () => {
    const { handle, written } = fakeHandle('notes.md')
    const showSaveFilePicker = vi.fn()
    const { files } = build(pickers(vi.fn(), showSaveFilePicker))
    expect(await files.save(request({ ref: handle }))).toEqual({
      kind: 'saved',
      name: 'notes.md',
      ref: handle,
      method: 'write',
    })
    expect(written).toEqual(['# Notes\n'])
    expect(showSaveFilePicker).not.toHaveBeenCalled()
  })

  it('asks for a file without a ref, suggesting the name', async () => {
    const { handle } = fakeHandle('picked.md')
    const showSaveFilePicker = vi.fn(async () => handle)
    const { files } = build(pickers(vi.fn(), showSaveFilePicker))
    expect(
      await files.save(request({ name: 'release-notes.md' })),
    ).toMatchObject({ kind: 'saved', name: 'picked.md', ref: handle })
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'release-notes.md' }),
    )
  })

  it('asks for a new file on Save as, even with a ref', async () => {
    const current = fakeHandle('notes.md')
    const copy = fakeHandle('copy.md')
    const { files } = build(pickers(vi.fn(), async () => copy.handle))
    await files.save(request({ ref: current.handle, saveAs: true }))
    expect(current.written).toEqual([])
    expect(copy.written).toEqual(['# Notes\n'])
  })

  it('never reports a conflict: the Web build does not check the disk', async () => {
    const { handle, written } = fakeHandle('notes.md', 'changed elsewhere')
    const { files } = build(pickers())
    expect(
      await files.save(request({ ref: handle, expected: 'what was read' })),
    ).toMatchObject({ kind: 'saved' })
    expect(written).toEqual(['# Notes\n'])
  })

  it('is cancelled when the save picker is', async () => {
    const { files } = build(
      pickers(vi.fn(), async () => {
        throw abortError()
      }),
    )
    expect(await files.save(request())).toEqual({ kind: 'cancelled' })
  })

  it('fails when the write fails', async () => {
    const { handle } = fakeHandle('notes.md', '', true)
    const { files } = build(pickers())
    expect(await files.save(request({ ref: handle }))).toEqual({
      kind: 'failed',
    })
  })

  it('downloads a copy without the pickers, with no ref', async () => {
    const { files, downloads } = build({})
    expect(await files.save(request())).toEqual({
      kind: 'saved',
      name: 'notes.md',
      ref: null,
      method: 'download',
    })
    expect(downloads).toEqual([{ name: 'notes.md', text: '# Notes\n' }])
  })
})

describe('one picker at a time', () => {
  it('ignores Open while a Save waits on the browser', async () => {
    const pending = deferred<MarkdownFileHandle>()
    const showOpenFilePicker = vi.fn()
    const { files } = build(pickers(showOpenFilePicker, () => pending.promise))
    const saving = files.save(request())
    expect(await files.open()).toEqual({ kind: 'cancelled' })
    expect(showOpenFilePicker).not.toHaveBeenCalled()
    pending.resolve(fakeHandle('one.md').handle)
    expect(await saving).toMatchObject({ kind: 'saved', name: 'one.md' })
  })

  it('ignores a second Open while the picker is up, then allows the next', async () => {
    const pending = deferred<readonly MarkdownFileHandle[]>()
    const showOpenFilePicker = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([fakeHandle('b.md', 'B').handle])
    const { files } = build(pickers(showOpenFilePicker))
    const first = files.open()
    expect(await files.open()).toEqual({ kind: 'cancelled' })
    pending.resolve([fakeHandle('a.md', 'A').handle])
    expect(await first).toMatchObject({ kind: 'opened' })
    expect(await files.open()).toMatchObject({ kind: 'opened' })
    expect(showOpenFilePicker).toHaveBeenCalledTimes(2)
  })

  it('ignores a second Save while the picker is up', async () => {
    const picked = deferred<MarkdownFileHandle>()
    const showSaveFilePicker = vi.fn(() => picked.promise)
    const { files } = build(pickers(vi.fn(), showSaveFilePicker))
    const first = files.save(request())
    expect(await files.save(request())).toEqual({ kind: 'cancelled' })
    picked.resolve(fakeHandle('a.md').handle)
    await first
    expect(showSaveFilePicker).toHaveBeenCalledTimes(1)
  })

  it('never locks on the file input, which may not report a cancel', async () => {
    const pickFile = vi
      .fn<FileFallback['pickFile']>()
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(new File(['# B'], 'b.md'))
    const files = createWebFiles({
      host: () => ({}),
      fallback: { pickFile, download: vi.fn() },
    })
    void files.open()
    expect(await files.open()).toMatchObject({ kind: 'opened' })
    expect(pickFile).toHaveBeenCalledTimes(2)
  })
})
