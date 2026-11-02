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
import type { LeaveChoice } from './leave-guard'
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
    refresh: vi.fn((next: string) => {
      calls.push('refresh')
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
  readonly choice?: LeaveChoice
  readonly untitledBaseline?: string
}

const setup = ({
  open = async () => ({ kind: 'cancelled' }),
  read = async () => ({ kind: 'cancelled' }),
  save = async () => ({ kind: 'cancelled' }),
  offered = async () => null,
  editor,
  session: initialSession = null,
  calls = [],
  choice,
  untitledBaseline = '',
}: Options = {}) => {
  let session = initialSession
  const events: FileSessionEvent<Ref>[] = []
  const notices: string[] = []
  const openedFiles: { text: string; name: string }[] = []
  const reloadedFiles: { text: string; name: string }[] = []
  const savedFiles: { text: string; name: string }[] = []
  const conflicts: { name: string; ref: Ref }[] = []
  const savingTexts: string[] = []
  const files: DocumentFiles<Ref> = {
    open: vi.fn(open),
    read: vi.fn(read),
    save: vi.fn(save),
  }
  const ask = vi.fn(async (_name: string) => choice ?? 'cancel')
  const discard = vi.fn()
  const actions = createFileActions({
    files,
    ...(choice !== undefined && { leave: { ask, discard, untitledBaseline } }),
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
      calls.push('onSaving')
      savingTexts.push(text)
    },
    onSaveEnded: () => {
      calls.push('onSaveEnded')
    },
    onOpened: (file) => {
      calls.push('onOpened')
      openedFiles.push(file)
    },
    onReloaded: (file) => {
      calls.push('onReloaded')
      reloadedFiles.push(file)
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
    reloadedFiles,
    savedFiles,
    conflicts,
    savingTexts,
    ask,
    discard,
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

describe('save ending', () => {
  const run = async (
    save: () => Promise<SaveResult<Ref>>,
    sessionOverride: FileSession<Ref> | null = sessionOf('# A\n', true),
  ) => {
    const calls: string[] = []
    const { editor } = fakeEditor('# A, edited\n', calls)
    const { actions } = setup({
      save,
      editor,
      session: sessionOverride,
      calls,
    })
    const result = await actions.save(false).catch(() => 'threw')
    return { calls: calls.filter((call) => call.startsWith('onSav')), result }
  }

  it.each([
    ['saved', async () => savedAs()],
    ['in conflict', async () => ({ kind: 'conflict' }) as const],
    ['failed', async () => ({ kind: 'failed' }) as const],
    ['cancelled', async () => ({ kind: 'cancelled' }) as const],
  ])(
    'tells the Save has ended after it %s, once the outcome is applied',
    async (_label, save) => {
      const { calls } = await run(save)
      expect(calls).toEqual(['onSaving', 'onSaveEnded'])
    },
  )

  it('tells the Save has ended when the write throws', async () => {
    const { calls, result } = await run(async () => {
      throw new Error('IPC closed')
    })
    expect(result).toBe('threw')
    expect(calls).toEqual(['onSaving', 'onSaveEnded'])
  })

  it('applies a saved outcome before it says the Save has ended', async () => {
    const calls: string[] = []
    const { editor } = fakeEditor('# A, edited\n', calls)
    const { actions } = setup({
      save: async () => savedAs(),
      editor,
      session: sessionOf('# A\n', true),
      calls,
    })
    await actions.save(false)
    expect(calls.indexOf('dispatch saved')).toBeLessThan(
      calls.indexOf('onSaveEnded'),
    )
  })
})

describe('reload', () => {
  it('replaces the Document with the disk text and drops the unsaved edits', async () => {
    const { editor } = fakeEditor('# A, mine\n')
    const { actions, session, notices, reloadedFiles, openedFiles } = setup({
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
    expect(reloadedFiles).toEqual([
      { text: '# A, by an agent\n', name: 'SKILL.md' },
    ])
    expect(openedFiles).toEqual([])
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

describe('openRef', () => {
  const OTHER: Ref = { path: '/skills/b/SKILL.md' }

  it('reads the file by its ref and replaces the Document, like Open', async () => {
    const { editor } = fakeEditor('Old.')
    const read = vi.fn(async () => opened('# B\n', 'SKILL.md', OTHER))
    const { actions, notices, session } = setup({ read, editor })
    await actions.openRef(OTHER)
    expect(read).toHaveBeenCalledWith(OTHER)
    expect(editor.replace).toHaveBeenCalledWith('# B\n')
    expect(session()).toMatchObject({ ref: OTHER, dirty: false })
    expect(notices).toEqual(['Opened SKILL.md'])
  })

  it('does nothing when that file is already the open one', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const { actions, files, notices } = setup({
      editor,
      session: sessionOf('# A\n', true),
    })
    await actions.openRef(REF)
    expect(files.read).not.toHaveBeenCalled()
    expect(editor.replace).not.toHaveBeenCalled()
    expect(notices).toEqual([])
  })

  it('says so when the file cannot be read, with the reason', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, notices } = setup({
      read: async () => ({ kind: 'failed', reason: 'Not a Markdown file' }),
      editor,
    })
    await actions.openRef(OTHER)
    expect(editor.replace).not.toHaveBeenCalled()
    expect(notices).toEqual(['Could not open the file: Not a Markdown file'])
  })

  it('offers the unsaved text kept for that file', async () => {
    const { editor } = fakeEditor('Old.')
    const { actions, session } = setup({
      read: async () => opened('# B\n', 'SKILL.md', OTHER),
      offered: async () => ({ text: '# B, unsaved\n', base: '# B\n' }),
      editor,
    })
    await actions.openRef(OTHER)
    expect(editor.replace).toHaveBeenCalledWith('# B, unsaved\n')
    expect(session()).toMatchObject({ dirty: true })
  })
})

describe('leaving a file with unsaved changes', () => {
  const OTHER: Ref = { path: '/skills/b/SKILL.md' }
  const dirty = sessionOf('# A\n', true)
  const toB = async (): Promise<OpenResult<Ref>> =>
    opened('# B\n', 'SKILL.md', OTHER)

  it('asks first, after the new file was read, and keeps everything on Cancel', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const { actions, ask, events, notices } = setup({
      read: toB,
      editor,
      session: dirty,
      choice: 'cancel',
    })
    await actions.openRef(OTHER)
    expect(ask).toHaveBeenCalledWith('SKILL.md')
    expect(editor.replace).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(notices).toEqual([])
  })

  it('does not ask about a file that cannot be read', async () => {
    const { actions, ask } = setup({
      read: async () => ({ kind: 'failed' }),
      session: dirty,
      choice: 'cancel',
    })
    await actions.openRef(OTHER)
    expect(ask).not.toHaveBeenCalled()
  })

  it('drops the unsaved text of the old file on Discard, then opens the new one', async () => {
    const calls: string[] = []
    const { editor } = fakeEditor('# A, edited\n', calls)
    const { actions, discard, session } = setup({
      read: toB,
      editor,
      session: dirty,
      choice: 'discard',
      calls,
    })
    await actions.openRef(OTHER)
    expect(discard).toHaveBeenCalledWith(REF)
    expect(editor.replace).toHaveBeenCalledWith('# B\n')
    expect(session()).toMatchObject({ ref: OTHER, dirty: false })
  })

  it('saves the old file on Save, then opens the new one', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const save = vi.fn(async () => savedAs())
    const { actions, session, files } = setup({
      read: toB,
      save,
      editor,
      session: dirty,
      choice: 'save',
    })
    await actions.openRef(OTHER)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ text: '# A, edited\n', ref: REF }),
    )
    expect(files.read).toHaveBeenCalledTimes(1)
    expect(editor.replace).toHaveBeenCalledWith('# B\n')
    expect(session()).toMatchObject({ ref: OTHER })
  })

  it('stays on the old file when the save did not go through', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const { actions, session, conflicts } = setup({
      read: toB,
      save: async () => ({ kind: 'conflict' }),
      editor,
      session: dirty,
      choice: 'save',
    })
    await actions.openRef(OTHER)
    expect(conflicts).toEqual([CONFLICT])
    expect(editor.replace).not.toHaveBeenCalled()
    expect(session()).toMatchObject({ ref: REF, dirty: true })
  })

  describe('picking the file that is open', () => {
    const edited = '# A, edited\n'

    const sameFile = (choice: LeaveChoice) => {
      let disk = '# A\n'
      const fake = fakeEditor(edited)
      const save = vi.fn(async (request: SaveRequest<Ref>) => {
        disk = request.text
        return savedAs()
      })
      const setupped = setup({
        open: async () => opened(disk),
        read: async () => opened(disk),
        save,
        editor: fake.editor,
        session: dirty,
        choice,
      })
      return { ...setupped, editor: fake.editor, disk: () => disk }
    }

    it('reads the file again after Save, so the text written is the text opened', async () => {
      const { actions, editor, session, openedFiles, files } = sameFile('save')
      await actions.open()
      expect(files.read).toHaveBeenCalledWith(REF)
      expect(editor.replace).toHaveBeenCalledWith(edited)
      expect(session()).toEqual({
        name: 'SKILL.md',
        ref: REF,
        savedText: edited,
        dirty: false,
      })
      expect(openedFiles).toEqual([{ text: edited, name: 'SKILL.md' }])
    })

    it('reads after the save finished, not before', async () => {
      const { actions, files } = sameFile('save')
      await actions.open()
      const [saved] = vi.mocked(files.save).mock.invocationCallOrder
      const [read] = vi.mocked(files.read).mock.invocationCallOrder
      expect(saved).toBeDefined()
      expect(read).toBeGreaterThan(saved ?? Number.POSITIVE_INFINITY)
    })

    it('says so when the file cannot be read after the save', async () => {
      const fake = fakeEditor(edited)
      const { actions, notices, session } = setup({
        open: async () => opened('# A\n'),
        read: async () => ({ kind: 'failed', reason: 'File not found' }),
        save: async () => savedAs(),
        editor: fake.editor,
        session: dirty,
        choice: 'save',
      })
      await actions.open()
      expect(fake.editor.replace).not.toHaveBeenCalled()
      expect(notices.at(-1)).toBe('Could not open the file: File not found')
      expect(session()).toMatchObject({ ref: REF })
    })

    it('reads the file again when Save as just wrote it, with no file open before', async () => {
      let disk = '# Sample\n'
      const fake = fakeEditor('# Sample, edited\n')
      const { actions, files, session } = setup({
        open: async () => opened(disk, 'sample.md'),
        read: async () => opened(disk, 'sample.md'),
        save: async (request) => {
          disk = request.text
          return savedAs('sample.md')
        },
        editor: fake.editor,
        choice: 'save',
        untitledBaseline: '# Sample\n',
      })
      await actions.open()
      expect(files.read).toHaveBeenCalledTimes(1)
      expect(fake.editor.replace).toHaveBeenCalledWith('# Sample, edited\n')
      expect(session()).toMatchObject({ dirty: false, ref: REF })
    })

    it('opens the disk text on Discard, with no second read', async () => {
      const { actions, editor, files, session } = sameFile('discard')
      await actions.open()
      expect(files.read).not.toHaveBeenCalled()
      expect(editor.replace).toHaveBeenCalledWith('# A\n')
      expect(session()).toMatchObject({ savedText: '# A\n', dirty: false })
    })

    it('reads nothing more when the Document was clean', async () => {
      const fake = fakeEditor('# A\n')
      const { actions, files } = setup({
        open: async () => opened('# A\n'),
        editor: fake.editor,
        session: sessionOf('# A\n'),
        choice: 'cancel',
      })
      await actions.open()
      expect(files.read).not.toHaveBeenCalled()
    })
  })

  describe('a Document with no file', () => {
    const STARTED = '# Sample\n'

    it('asks when it was edited, and stays on Cancel', async () => {
      const { editor } = fakeEditor('# Sample, edited\n')
      const { actions, ask, events } = setup({
        read: toB,
        editor,
        choice: 'cancel',
        untitledBaseline: STARTED,
      })
      await actions.openRef(OTHER)
      expect(ask).toHaveBeenCalledWith('Untitled')
      expect(editor.replace).not.toHaveBeenCalled()
      expect(events).toEqual([])
    })

    it('goes on silently when it was not edited', async () => {
      const { editor } = fakeEditor(STARTED)
      const { actions, ask } = setup({
        read: toB,
        editor,
        choice: 'cancel',
        untitledBaseline: STARTED,
      })
      await actions.openRef(OTHER)
      expect(ask).not.toHaveBeenCalled()
      expect(editor.replace).toHaveBeenCalledWith('# B\n')
    })

    it('is replaced on Discard', async () => {
      const { editor } = fakeEditor('# Sample, edited\n')
      const { actions, discard, session } = setup({
        read: toB,
        editor,
        choice: 'discard',
        untitledBaseline: STARTED,
      })
      await actions.openRef(OTHER)
      expect(discard).not.toHaveBeenCalled()
      expect(editor.replace).toHaveBeenCalledWith('# B\n')
      expect(session()).toMatchObject({ ref: OTHER })
    })

    it('goes to Save as on Save, then opens the file', async () => {
      const { editor } = fakeEditor('# Sample, edited\n')
      const save = vi.fn(async () =>
        savedAs('sample.md', { path: '/p/sample.md' }),
      )
      const { actions, session } = setup({
        read: toB,
        save,
        editor,
        choice: 'save',
        untitledBaseline: STARTED,
      })
      await actions.openRef(OTHER)
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ ref: null, saveAs: false }),
      )
      expect(editor.replace).toHaveBeenCalledWith('# B\n')
      expect(session()).toMatchObject({ ref: OTHER })
    })

    it('stays when the Save as is cancelled', async () => {
      const { editor } = fakeEditor('# Sample, edited\n')
      const { actions, session } = setup({
        read: toB,
        save: async () => ({ kind: 'cancelled' }),
        editor,
        choice: 'save',
        untitledBaseline: STARTED,
      })
      await actions.openRef(OTHER)
      expect(editor.replace).not.toHaveBeenCalled()
      expect(session()).toBeNull()
    })
  })

  it('applies to Open too, after the file was picked', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const { actions, ask, files } = setup({
      open: toB,
      editor,
      session: dirty,
      choice: 'cancel',
    })
    await actions.open()
    expect(files.open).toHaveBeenCalledTimes(1)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(editor.replace).not.toHaveBeenCalled()
  })

  it('does not apply to Reload from disk, which is a choice already made', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const { actions, ask } = setup({
      read: async () => opened('# A, by an agent\n'),
      editor,
      session: dirty,
      choice: 'cancel',
    })
    await actions.reload(CONFLICT)
    expect(ask).not.toHaveBeenCalled()
    expect(editor.replace).toHaveBeenCalledWith('# A, by an agent\n')
  })

  it('does not ask when the build gives no question to ask', async () => {
    const { editor } = fakeEditor('# A, edited\n')
    const { actions } = setup({ read: toB, editor, session: dirty })
    await actions.openRef(OTHER)
    expect(editor.replace).toHaveBeenCalledWith('# B\n')
  })
})

describe('save result', () => {
  it('is true when the file was written', async () => {
    const { actions } = setup({ save: async () => savedAs() })
    expect(await actions.save(false)).toBe(true)
  })

  it.each([
    ['cancelled', { kind: 'cancelled' } as const],
    ['conflict', { kind: 'conflict' } as const],
    ['failed', { kind: 'failed' } as const],
  ])('is false when the save is %s', async (_name, result) => {
    const { actions } = setup({ save: async () => result })
    expect(await actions.save(false)).toBe(false)
  })

  it('is false when there is no editor yet', async () => {
    const { actions } = setup({ editor: null })
    expect(await actions.save(false)).toBe(false)
  })
})

describe('reloadFrom', () => {
  const FILE = { name: 'SKILL.md', text: '# A, by an agent\n', ref: REF }

  it('takes the text already read, keeping the cursor, and starts a clean session', () => {
    const calls: string[] = []
    const { editor } = fakeEditor('# A\n', calls)
    const { actions, session, notices, reloadedFiles, openedFiles, files } =
      setup({ editor, session: sessionOf('# A\n'), calls })
    actions.reloadFrom(FILE)
    expect(editor.refresh).toHaveBeenCalledWith('# A, by an agent\n')
    expect(editor.replace).not.toHaveBeenCalled()
    expect(files.read).not.toHaveBeenCalled()
    expect(session()).toEqual({
      name: 'SKILL.md',
      ref: REF,
      savedText: '# A, by an agent\n',
      dirty: false,
    })
    expect(reloadedFiles).toEqual([
      { text: '# A, by an agent\n', name: 'SKILL.md' },
    ])
    expect(openedFiles).toEqual([])
    expect(notices).toEqual(['Reloaded SKILL.md: it changed on disk'])
  })

  it('points the session at the file before the text changes, then reports it', () => {
    const calls: string[] = []
    const { editor } = fakeEditor('# A\n', calls)
    const { actions } = setup({ editor, session: sessionOf('# A\n'), calls })
    actions.reloadFrom(FILE)
    expect(calls).toEqual(['dispatch opened', 'refresh', 'onReloaded'])
  })

  it('does nothing before the editor exists', () => {
    const { actions, events, reloadedFiles } = setup({ editor: null })
    actions.reloadFrom(FILE)
    expect(events).toEqual([])
    expect(reloadedFiles).toEqual([])
  })
})
