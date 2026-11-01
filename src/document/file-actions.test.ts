import { describe, expect, it, vi } from 'vitest'
import type {
  DocumentFiles,
  OpenResult,
  SaveRequest,
  SaveResult,
} from '../platform/kit'
import { createFileActions, type EditorText } from './file-actions'
import {
  type FileSession,
  type FileSessionEvent,
  nextFileSession,
} from './file-session'
import type { Unsaved } from './unsaved'

type Ref = { readonly path: string }

const REF: Ref = { path: '/skills/a/SKILL.md' }
const CONFLICT = { name: 'SKILL.md', ref: REF }

const opened = (
  text: string,
  name = 'SKILL.md',
  ref: Ref | null = REF,
): OpenResult<Ref> => ({ kind: 'opened', file: { name, text, ref } })

const savedAs = (
  name = 'SKILL.md',
  ref: Ref | null = REF,
): SaveResult<Ref> => ({
  kind: 'saved',
  name,
  ref,
  method: 'write',
})

const fakeEditor = (initial: string, calls: string[] = []) => {
  let text = initial
  const editor: EditorText = {
    text: () => text,
    replace: vi.fn((next: string) => {
      calls.push('replace')
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
  readonly open?: () => Promise<OpenResult<Ref>>
  readonly read?: (ref: Ref) => Promise<OpenResult<Ref>>
  readonly save?: (request: SaveRequest<Ref>) => Promise<SaveResult<Ref>>
  readonly offered?: (ref: Ref) => Promise<Unsaved | null>
  readonly editor?: EditorText | null
  readonly session?: FileSession<Ref> | null
  readonly calls?: string[]
}

const setup = ({
  open = async () => ({ kind: 'cancelled' }),
  read = async () => ({ kind: 'cancelled' }),
  save = async () => ({ kind: 'cancelled' }),
  offered = async () => null,
  editor,
  session: initialSession = null,
  calls = [],
}: Options = {}) => {
  let session = initialSession
  const events: FileSessionEvent<Ref>[] = []
  const notices: string[] = []
  const openedFiles: { text: string; name: string }[] = []
  const savedFiles: { text: string; name: string }[] = []
  const conflicts: { name: string; ref: Ref }[] = []
  const savingTexts: string[] = []
  const files: DocumentFiles<Ref> = {
    open: vi.fn(open),
    read: vi.fn(read),
    save: vi.fn(save),
  }
  const actions = createFileActions({
    files,
    offered: vi.fn(offered),
    editor: () => (editor === undefined ? fakeEditor('').editor : editor),
    session: () => session,
    dispatch: (event) => {
      calls.push(`dispatch ${event.type}`)
      events.push(event)
      session = nextFileSession(session, event)
    },
    notify: (text) => {
      notices.push(text)
    },
    onSaving: (text) => {
      savingTexts.push(text)
    },
    onOpened: (file) => {
      calls.push('onOpened')
      openedFiles.push(file)
    },
    onSaved: (file) => {
      savedFiles.push(file)
    },
    onConflict: (conflict) => {
      conflicts.push(conflict)
    },
  })
  return {
    actions,
    files,
    events,
    notices,
    openedFiles,
    savedFiles,
    conflicts,
    savingTexts,
    session: () => session,
  }
}

const sessionOf = (savedText: string, dirty = false): FileSession<Ref> => ({
  name: 'SKILL.md',
  ref: REF,
  savedText,
  dirty,
})

describe('open', () => {
  it('replaces the Document with the file and starts a clean session', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, notices, session } = setup({
      open: async () => opened('# Notes\n', 'notes.md'),
      editor,
    })
    await actions.open()
    expect(editor.replace).toHaveBeenCalledWith('# Notes\n')
    expect(session()).toEqual({
      name: 'notes.md',
      ref: REF,
      savedText: '# Notes\n',
      dirty: false,
    })
    expect(notices).toEqual(['Opened notes.md'])
  })

  it('points the session at the new file before the text is replaced, then reports the History event', async () => {
    const calls: string[] = []
    const { editor } = fakeEditor('Old.', calls)
    const { actions, openedFiles } = setup({
      open: async () => opened('# Notes\n', 'notes.md'),
      editor,
      calls,
    })
    await actions.open()
    expect(calls).toEqual(['dispatch opened', 'replace', 'onOpened'])
    expect(openedFiles).toEqual([{ text: '# Notes\n', name: 'notes.md' }])
  })

  it('does nothing when the file dialog is cancelled', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, notices, events } = setup({ editor })
    await actions.open()
    expect(editor.replace).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(notices).toEqual([])
  })

  it('says so when the file cannot be read', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, notices } = setup({
      open: async () => ({ kind: 'failed' }),
      editor,
    })
    await actions.open()
    expect(editor.replace).not.toHaveBeenCalled()
    expect(notices).toEqual(['Could not open the file'])
  })

  it('adds the reason when there is one', async () => {
    const { actions, notices } = setup({
      open: async () => ({ kind: 'failed', reason: 'Permission denied' }),
    })
    await actions.open()
    expect(notices).toEqual(['Could not open the file: Permission denied'])
  })

  it('does not ask for a file before the editor exists', async () => {
    const { actions, files } = setup({ editor: null })
    await actions.open()
    expect(files.open).not.toHaveBeenCalled()
  })

  it('offers the unsaved text kept for that file and starts dirty', async () => {
    const { editor } = fakeEditor('Old.')
    const offered = vi.fn(async () => ({
      text: '# A, unsaved\n',
      base: '# A\n',
    }))
    const { actions, notices, session, conflicts } = setup({
      open: async () => opened('# A\n'),
      offered,
      editor,
    })
    await actions.open()
    expect(offered).toHaveBeenCalledWith(REF)
    expect(editor.replace).toHaveBeenCalledWith('# A, unsaved\n')
    expect(session()).toMatchObject({ savedText: '# A\n', dirty: true })
    expect(notices).toEqual(['Restored unsaved changes to SKILL.md'])
    expect(conflicts).toEqual([])
  })

  it('shows the External change notice when the file changed since the unsaved text began', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, session, conflicts } = setup({
      open: async () => opened('# A, by an agent\n'),
      offered: async () => ({ text: '# A, mine\n', base: '# A\n' }),
      editor,
    })
    await actions.open()
    expect(session()).toMatchObject({ savedText: '# A\n', dirty: true })
    expect(conflicts).toEqual([{ name: 'SKILL.md', ref: REF }])
  })

  it('does not look for unsaved text without a ref', async () => {
    const offered = vi.fn(async () => null)
    const { actions } = setup({
      open: async () => opened('# Hi', 'hi.md', null),
      offered,
    })
    await actions.open()
    expect(offered).not.toHaveBeenCalled()
  })

  it('opens the disk text when the unsaved text cannot be read', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, session } = setup({
      open: async () => opened('# A\n'),
      offered: async () => {
        throw new Error('storage broken')
      },
      editor,
    })
    await actions.open()
    expect(editor.replace).toHaveBeenCalledWith('# A\n')
    expect(session()).toMatchObject({ dirty: false })
  })
})

describe('save', () => {
  it('suggests a name from the title and asks for no ref', async () => {
    const { editor } = fakeEditor('# Release Notes\n')
    const save = vi.fn(async () =>
      savedAs('picked.md', { path: '/p/picked.md' }),
    )
    const { actions, notices, session } = setup({ save, editor })
    await actions.save(false)
    expect(save).toHaveBeenCalledWith({
      text: '# Release Notes\n',
      ref: null,
      name: 'release-notes.md',
      expected: null,
      saveAs: false,
    })
    expect(session()).toMatchObject({ name: 'picked.md', dirty: false })
    expect(notices).toEqual(['Saved picked.md'])
  })

  it('sends the session name, ref and last known text', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const save = vi.fn(async () => savedAs())
    const { actions } = setup({
      save,
      editor,
      session: sessionOf('# A\n', true),
    })
    await actions.save(false)
    expect(save).toHaveBeenCalledWith({
      text: '# A, edited\n',
      ref: REF,
      name: 'SKILL.md',
      expected: '# A\n',
      saveAs: false,
    })
  })

  it('passes Save as on', async () => {
    const { editor } = fakeEditor('# A\n')
    const save = vi.fn(async () => savedAs())
    const { actions } = setup({ save, editor, session: sessionOf('# A\n') })
    await actions.save(true)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ saveAs: true }))
  })

  it('reports the text it saves before the files answer', async () => {
    const { editor } = fakeEditor('# A\n')
    const { actions, savingTexts, files } = setup({
      save: async () => savedAs(),
      editor,
    })
    const saving = actions.save(false)
    expect(savingTexts).toEqual(['# A\n'])
    expect(files.save).toHaveBeenCalledTimes(1)
    await saving
  })

  it('reports the saved file to the History after the session moved', async () => {
    const { editor } = fakeEditor('# A\n')
    const { actions, savedFiles, session } = setup({
      save: async () => savedAs('a.md'),
      editor,
    })
    await actions.save(false)
    expect(savedFiles).toEqual([{ text: '# A\n', name: 'a.md' }])
    expect(session()?.savedText).toBe('# A\n')
  })

  it('stays dirty when the text changed while the save ran', async () => {
    const fake = fakeEditor('# A\n')
    const { actions, session } = setup({
      save: async () => {
        fake.type('# A, more\n')
        return savedAs('a.md')
      },
      editor: fake.editor,
    })
    await actions.save(false)
    expect(session()).toMatchObject({ savedText: '# A\n', dirty: true })
  })

  it('says Downloaded for a copy', async () => {
    const { editor } = fakeEditor('# Notes\n')
    const { actions, notices } = setup({
      save: async () => ({
        kind: 'saved',
        name: 'notes.md',
        ref: null,
        method: 'download',
      }),
      editor,
    })
    await actions.save(false)
    expect(notices).toEqual(['Downloaded notes.md'])
  })

  it('stops on a conflict: no session change, no Saved notice, the External change notice', async () => {
    const { editor } = fakeEditor('# A, mine\n')
    const { actions, notices, events, conflicts, savedFiles } = setup({
      save: async () => ({ kind: 'conflict' }),
      editor,
      session: sessionOf('# A\n', true),
    })
    await actions.save(false)
    expect(events).toEqual([])
    expect(notices).toEqual([])
    expect(savedFiles).toEqual([])
    expect(conflicts).toEqual([{ name: 'SKILL.md', ref: REF }])
  })

  it('names the file when the save fails, with the reason', async () => {
    const { editor } = fakeEditor('# Notes\n')
    const { actions, notices } = setup({
      save: async () => ({ kind: 'failed', reason: 'Permission denied' }),
      editor,
    })
    await actions.save(false)
    expect(notices).toEqual(['Could not save notes.md: Permission denied'])
  })

  it('names the file when the save fails without a reason', async () => {
    const { editor } = fakeEditor('# Notes\n')
    const { actions, notices } = setup({
      save: async () => ({ kind: 'failed' }),
      editor,
    })
    await actions.save(false)
    expect(notices).toEqual(['Could not save notes.md'])
  })

  it('does nothing when the save dialog is cancelled', async () => {
    const { editor } = fakeEditor('# Notes\n')
    const { actions, notices, events } = setup({ editor })
    await actions.save(false)
    expect(notices).toEqual([])
    expect(events).toEqual([])
  })

  it('does not save before the editor exists', async () => {
    const { actions, files } = setup({ editor: null })
    await actions.save(false)
    expect(files.save).not.toHaveBeenCalled()
  })
})

describe('reload', () => {
  it('replaces the Document with the disk text and drops the unsaved edits', async () => {
    const { editor } = fakeEditor('# A, mine\n')
    const { actions, session, notices, openedFiles } = setup({
      read: async () => opened('# A, by an agent\n'),
      editor,
      session: sessionOf('# A\n', true),
    })
    await actions.reload(CONFLICT)
    expect(editor.replace).toHaveBeenCalledWith('# A, by an agent\n')
    expect(session()).toEqual({
      name: 'SKILL.md',
      ref: REF,
      savedText: '# A, by an agent\n',
      dirty: false,
    })
    expect(notices).toEqual(['Reloaded SKILL.md'])
    expect(openedFiles).toEqual([
      { text: '# A, by an agent\n', name: 'SKILL.md' },
    ])
  })

  it('does not offer the old unsaved text again', async () => {
    const offered = vi.fn(async () => ({ text: 'x', base: 'y' }))
    const { actions } = setup({ read: async () => opened('# A\n'), offered })
    await actions.reload(CONFLICT)
    expect(offered).not.toHaveBeenCalled()
  })

  it('keeps the Document and says why when the file cannot be read', async () => {
    const { editor } = fakeEditor('# A, mine\n')
    const { actions, notices, events } = setup({
      read: async () => ({ kind: 'failed', reason: 'File not found' }),
      editor,
      session: sessionOf('# A\n', true),
    })
    await actions.reload(CONFLICT)
    expect(editor.replace).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(notices).toEqual(['Could not reload SKILL.md: File not found'])
  })
})
