import { describe, expect, it, vi } from 'vitest'
import type { FileSession } from './file-session'
import {
  confirmLeave,
  type LeaveChoice,
  type LeaveOutcome,
  UNTITLED_NAME,
} from './leave-guard'

const STARTED = '# Sample\n'

const session = (
  dirty: boolean,
  ref: string | null = '/a/SKILL.md',
): FileSession<string> => ({
  name: 'SKILL.md',
  ref,
  savedText: '# A\n',
  dirty,
})

const setup = (choice: LeaveChoice | Error, saved = true) => {
  const ask = vi.fn(async (_name: string) => {
    if (choice instanceof Error) throw choice
    return choice
  })
  const discard = vi.fn()
  const save = vi.fn(async () => saved)
  const leave = (
    file: FileSession<string> | null,
    text = file === null ? STARTED : '# A, edited\n',
  ): Promise<LeaveOutcome> =>
    confirmLeave({
      session: file,
      text,
      leave: { ask, discard, initialText: STARTED },
      save,
    })
  return { ask, discard, save, leave }
}

describe('confirmLeave', () => {
  it.each([
    ['a clean file', session(false)],
    ['no file and no edits', null],
  ])('lets %s go without asking', async (_name, file) => {
    const { ask, leave } = setup('cancel')
    expect(await leave(file, file === null ? STARTED : '# A\n')).toBe('leave')
    expect(ask).not.toHaveBeenCalled()
  })

  it('asks about the file by name when it has unsaved changes', async () => {
    const { ask, leave } = setup('cancel')
    await leave(session(true))
    expect(ask).toHaveBeenCalledWith('SKILL.md')
  })

  it('stays when the answer is Cancel, touching nothing', async () => {
    const { discard, save, leave } = setup('cancel')
    expect(await leave(session(true))).toBe('stay')
    expect(discard).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('leaves and drops the unsaved text of that file on Discard', async () => {
    const { discard, save, leave } = setup('discard')
    expect(await leave(session(true))).toBe('leave')
    expect(discard).toHaveBeenCalledWith('/a/SKILL.md')
    expect(save).not.toHaveBeenCalled()
  })

  it('has nothing to drop for a file with no ref', async () => {
    const { discard, leave } = setup('discard')
    expect(await leave(session(true, null))).toBe('leave')
    expect(discard).not.toHaveBeenCalled()
  })

  it('saves first on Save, and says so, only if the save went through', async () => {
    const done = setup('save', true)
    expect(await done.leave(session(true))).toBe('saved')
    expect(done.save).toHaveBeenCalledTimes(1)
    expect(done.discard).not.toHaveBeenCalled()

    const stopped = setup('save', false)
    expect(await stopped.leave(session(true))).toBe('stay')
  })

  it('stays when the question cannot be asked', async () => {
    const { leave, discard, save } = setup(new Error('no window'))
    expect(await leave(session(true))).toBe('stay')
    expect(discard).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  describe('a Document with no file', () => {
    const edited = '# Sample, edited\n'

    it('asks when its text differs from the text it started with', async () => {
      const { ask, leave } = setup('cancel')
      expect(await leave(null, edited)).toBe('stay')
      expect(ask).toHaveBeenCalledWith(UNTITLED_NAME)
    })

    it('leaves on Discard, with no file to drop the text of', async () => {
      const { discard, leave } = setup('discard')
      expect(await leave(null, edited)).toBe('leave')
      expect(discard).not.toHaveBeenCalled()
    })

    it('saves on Save, which has to ask for a file', async () => {
      const { save, leave } = setup('save')
      expect(await leave(null, edited)).toBe('saved')
      expect(save).toHaveBeenCalledTimes(1)
    })

    it('stays when the save is cancelled', async () => {
      const { leave } = setup('save', false)
      expect(await leave(null, edited)).toBe('stay')
    })
  })
})
