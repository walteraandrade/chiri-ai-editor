import { describe, expect, it, vi } from 'vitest'
import type { FileSession } from './file-session'
import { confirmLeave, type LeaveChoice } from './leave-guard'

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
  const leave = (file: FileSession<string> | null) =>
    confirmLeave({ session: file, leave: { ask, discard }, save })
  return { ask, discard, save, leave }
}

describe('confirmLeave', () => {
  it.each([
    ['no file', null],
    ['a clean file', session(false)],
  ])('lets %s go without asking', async (_name, file) => {
    const { ask, leave } = setup('cancel')
    expect(await leave(file)).toBe(true)
    expect(ask).not.toHaveBeenCalled()
  })

  it('asks about the file by name when it has unsaved changes', async () => {
    const { ask, leave } = setup('cancel')
    await leave(session(true))
    expect(ask).toHaveBeenCalledWith('SKILL.md')
  })

  it('stays when the answer is Cancel, touching nothing', async () => {
    const { discard, save, leave } = setup('cancel')
    expect(await leave(session(true))).toBe(false)
    expect(discard).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('leaves and drops the unsaved text of that file on Discard', async () => {
    const { discard, save, leave } = setup('discard')
    expect(await leave(session(true))).toBe(true)
    expect(discard).toHaveBeenCalledWith('/a/SKILL.md')
    expect(save).not.toHaveBeenCalled()
  })

  it('has nothing to drop for a file with no ref', async () => {
    const { discard, leave } = setup('discard')
    expect(await leave(session(true, null))).toBe(true)
    expect(discard).not.toHaveBeenCalled()
  })

  it('saves first on Save, and leaves only if the save went through', async () => {
    const done = setup('save', true)
    expect(await done.leave(session(true))).toBe(true)
    expect(done.save).toHaveBeenCalledTimes(1)
    expect(done.discard).not.toHaveBeenCalled()

    const stopped = setup('save', false)
    expect(await stopped.leave(session(true))).toBe(false)
  })

  it('stays when the question cannot be asked', async () => {
    const { leave, discard, save } = setup(new Error('no window'))
    expect(await leave(session(true))).toBe(false)
    expect(discard).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})
