import { describe, expect, it, vi } from 'vitest'
import type { FileFallback, FileHost, MarkdownFileHandle } from './file-access'
import { createFileActions, type EditorText } from './file-actions'
import {
  type FileSession,
  type FileSessionEvent,
  nextFileSession,
} from './file-session'

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const fakeHandle = (name: string, content = ''): MarkdownFileHandle => ({
  name,
  getFile: async () => new File([content], name),
  createWritable: async () => ({
    write: async () => undefined,
    close: async () => undefined,
    abort: async () => undefined,
  }),
})

const fakeEditor = (initial: string) => {
  let text = initial
  const editor: EditorText = {
    text: () => text,
    replace: vi.fn((next: string) => {
      text = next
    }),
  }
  return {
    editor,
    type: (next: string) => {
      text = next
    },
  }
}

type Options = {
  readonly host?: FileHost
  readonly fallback?: FileFallback
  readonly editor?: EditorText | null
  readonly onSaving?: (text: string) => void
}

const setup = ({ host = {}, fallback, editor, onSaving }: Options = {}) => {
  let session: FileSession<MarkdownFileHandle> | null = null
  const events: FileSessionEvent<MarkdownFileHandle>[] = []
  const notices: string[] = []
  const downloads: string[] = []
  const actions = createFileActions({
    host: () => host,
    fallback: fallback ?? {
      pickFile: async () => null,
      download: (name) => {
        downloads.push(name)
      },
    },
    editor: () => (editor === undefined ? fakeEditor('').editor : editor),
    session: () => session,
    dispatch: (event) => {
      events.push(event)
      session = nextFileSession(session, event)
    },
    notify: (text) => {
      notices.push(text)
    },
    ...(onSaving && { onSaving }),
  })
  return { actions, events, notices, downloads, session: () => session }
}

describe('open', () => {
  it('replaces the Document with the file and starts a clean session', async () => {
    const { editor } = fakeEditor('Old.')
    const handle = fakeHandle('notes.md', '# Notes\r\n')
    const host: FileHost = {
      showOpenFilePicker: async () => [handle],
      showSaveFilePicker: vi.fn(),
    }
    const { actions, notices, session } = setup({ host, editor })
    await actions.open()
    expect(editor.replace).toHaveBeenCalledWith('# Notes\n')
    expect(session()).toEqual({
      name: 'notes.md',
      handle,
      savedText: '# Notes\n',
      dirty: false,
    })
    expect(notices).toEqual(['Opened notes.md'])
  })

  it('does nothing when the picker is cancelled', async () => {
    const { editor } = fakeEditor('Old.')
    const host: FileHost = {
      showOpenFilePicker: async () => {
        throw new DOMException('Cancelled.', 'AbortError')
      },
      showSaveFilePicker: vi.fn(),
    }
    const { actions, notices, events } = setup({ host, editor })
    await actions.open()
    expect(editor.replace).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(notices).toEqual([])
  })

  it('says so when the file cannot be read', async () => {
    const { editor } = fakeEditor('Old.')
    const host: FileHost = {
      showOpenFilePicker: async () => {
        throw new DOMException('Denied.', 'NotAllowedError')
      },
      showSaveFilePicker: vi.fn(),
    }
    const { actions, notices } = setup({ host, editor })
    await actions.open()
    expect(editor.replace).not.toHaveBeenCalled()
    expect(notices).toEqual(['Could not open the file'])
  })

  it('does not ask for a file before the editor exists', async () => {
    const open = vi.fn()
    const { actions } = setup({
      host: { showOpenFilePicker: open, showSaveFilePicker: vi.fn() },
      editor: null,
    })
    await actions.open()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('save', () => {
  it('suggests a name from the title, then keeps the file it got', async () => {
    const { editor } = fakeEditor('# Release Notes\n')
    const handle = fakeHandle('picked.md')
    const showSaveFilePicker = vi.fn(async () => handle)
    const { actions, notices, session } = setup({
      host: { showOpenFilePicker: vi.fn(), showSaveFilePicker },
      editor,
    })
    await actions.save(false)
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'release-notes.md' }),
    )
    expect(session()).toMatchObject({ name: 'picked.md', handle, dirty: false })
    expect(notices).toEqual(['Saved picked.md'])
  })

  it('reports the text it saves before the picker answers', async () => {
    const { editor } = fakeEditor('# A\n')
    const picked = deferred<MarkdownFileHandle>()
    const onSaving = vi.fn()
    const { actions } = setup({
      host: {
        showOpenFilePicker: vi.fn(),
        showSaveFilePicker: () => picked.promise,
      },
      editor,
      onSaving,
    })
    const saving = actions.save(false)
    expect(onSaving).toHaveBeenCalledWith('# A\n')
    picked.resolve(fakeHandle('a.md'))
    await saving
    expect(onSaving).toHaveBeenCalledTimes(1)
  })

  it('stays dirty when the text changed while the save ran', async () => {
    const fake = fakeEditor('# A\n')
    const handle = fakeHandle('a.md')
    const { actions, session } = setup({
      host: {
        showOpenFilePicker: vi.fn(),
        showSaveFilePicker: async () => {
          fake.type('# A, more\n')
          return handle
        },
      },
      editor: fake.editor,
    })
    await actions.save(false)
    expect(session()).toMatchObject({ savedText: '# A\n', dirty: true })
  })

  it('says Downloaded without the pickers', async () => {
    const { editor } = fakeEditor('# Notes\n')
    const { actions, notices, downloads } = setup({ editor })
    await actions.save(false)
    expect(downloads).toEqual(['notes.md'])
    expect(notices).toEqual(['Downloaded notes.md'])
  })

  it('names the file when the write fails', async () => {
    const { editor } = fakeEditor('# Notes\n')
    const { actions, notices } = setup({
      host: {
        showOpenFilePicker: vi.fn(),
        showSaveFilePicker: async () => {
          throw new DOMException('Denied.', 'NotAllowedError')
        },
      },
      editor,
    })
    await actions.save(false)
    expect(notices).toEqual(['Could not save notes.md'])
  })
})

describe('one file action at a time', () => {
  it('ignores Open while a Save waits on the browser', async () => {
    const { editor } = fakeEditor('# One\n')
    const pending = deferred<MarkdownFileHandle>()
    const showOpenFilePicker = vi.fn()
    const { actions, session } = setup({
      host: {
        showOpenFilePicker,
        showSaveFilePicker: () => pending.promise,
      },
      editor,
    })
    const saving = actions.save(false)
    await actions.open()
    expect(showOpenFilePicker).not.toHaveBeenCalled()
    pending.resolve(fakeHandle('one.md'))
    await saving
    expect(session()?.name).toBe('one.md')
  })

  it('ignores a second Open while the picker is up, then allows the next one', async () => {
    const { editor } = fakeEditor('Old.')
    const pending = deferred<readonly MarkdownFileHandle[]>()
    const showOpenFilePicker = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([fakeHandle('b.md', 'B')])
    const { actions, notices } = setup({
      host: { showOpenFilePicker, showSaveFilePicker: vi.fn() },
      editor,
    })
    const first = actions.open()
    await actions.open()
    pending.resolve([fakeHandle('a.md', 'A')])
    await first
    await actions.open()
    expect(showOpenFilePicker).toHaveBeenCalledTimes(2)
    expect(notices).toEqual(['Opened a.md', 'Opened b.md'])
  })

  it('reports the text once when a second Save comes while the picker is up', async () => {
    const { editor } = fakeEditor('# A\n')
    const picked = deferred<MarkdownFileHandle>()
    const onSaving = vi.fn()
    const { actions } = setup({
      host: {
        showOpenFilePicker: vi.fn(),
        showSaveFilePicker: () => picked.promise,
      },
      editor,
      onSaving,
    })
    const first = actions.save(false)
    await actions.save(false)
    picked.resolve(fakeHandle('a.md'))
    await first
    expect(onSaving).toHaveBeenCalledTimes(1)
  })

  it('never locks on the file input, which may not report a cancel', async () => {
    const { editor } = fakeEditor('Old.')
    const pickFile = vi
      .fn<FileFallback['pickFile']>()
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(new File(['# B'], 'b.md'))
    const { actions, notices } = setup({
      fallback: { pickFile, download: vi.fn() },
      editor,
    })
    void actions.open()
    await actions.open()
    expect(pickFile).toHaveBeenCalledTimes(2)
    expect(notices).toEqual(['Opened b.md'])
  })
})
