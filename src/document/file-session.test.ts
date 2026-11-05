import { describe, expect, it } from 'vitest'
import { type FileSession, nextFileSession } from './file-session'

const REF = { kind: 'ref' }

const opened = (): FileSession<typeof REF> | null =>
  nextFileSession<typeof REF>(null, {
    type: 'opened',
    name: 'notes.md',
    ref: REF,
    text: 'Hello',
    savedText: 'Hello',
  })

describe('nextFileSession', () => {
  it('starts a clean session when a file is opened', () => {
    expect(opened()).toEqual({
      name: 'notes.md',
      ref: REF,
      savedText: 'Hello',
      dirty: false,
    })
  })

  it('starts dirty when the Document shows unsaved text over the file', () => {
    expect(
      nextFileSession<typeof REF>(null, {
        type: 'opened',
        name: 'notes.md',
        ref: REF,
        text: 'Hello, unsaved',
        savedText: 'Hello',
      }),
    ).toEqual({
      name: 'notes.md',
      ref: REF,
      savedText: 'Hello',
      dirty: true,
    })
  })

  it('marks the session dirty when the text differs from the file', () => {
    expect(
      nextFileSession(opened(), { type: 'edited', text: 'Hello!' }),
    ).toEqual({ ...opened(), dirty: true })
  })

  it('marks it clean again when the text goes back to what the file has', () => {
    const dirty = nextFileSession(opened(), { type: 'edited', text: 'Hi' })
    expect(
      nextFileSession(dirty, { type: 'edited', text: 'Hello' })?.dirty,
    ).toBe(false)
  })

  it('returns the same session when the dirty flag does not change', () => {
    const session = opened()
    expect(nextFileSession(session, { type: 'edited', text: 'Hello' })).toBe(
      session,
    )
  })

  it('ignores edits without a file', () => {
    expect(nextFileSession(null, { type: 'edited', text: 'Hi' })).toBeNull()
  })

  it('takes the name and ref a save returns', () => {
    const other = { kind: 'other' }
    const saved = nextFileSession<object>(null, {
      type: 'saved',
      name: 'draft.md',
      ref: other,
      text: 'Draft',
      current: 'Draft',
    })
    expect(saved).toEqual({
      name: 'draft.md',
      ref: other,
      savedText: 'Draft',
      dirty: false,
    })
  })

  it('stays dirty when the text changed while the save was running', () => {
    const saved = nextFileSession(opened(), {
      type: 'saved',
      name: 'notes.md',
      ref: REF,
      text: 'Hello!',
      current: 'Hello!?',
    })
    expect(saved).toMatchObject({ savedText: 'Hello!', dirty: true })
  })

  it('keeps a download without a ref', () => {
    const saved = nextFileSession(opened(), {
      type: 'saved',
      name: 'notes.md',
      ref: null,
      text: 'Hello',
      current: 'Hello',
    })
    expect(saved?.ref).toBeNull()
  })
})
