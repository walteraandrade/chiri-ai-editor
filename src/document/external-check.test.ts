import { describe, expect, it, vi } from 'vitest'
import type { DiskRead } from '../platform/kit'
import { createExternalCheck } from './external-check'
import type { FileSession } from './file-session'

const REF = '/skills/a/SKILL.md'

const session = (
  overrides: Partial<FileSession<string>> = {},
): FileSession<string> => ({
  name: 'SKILL.md',
  ref: REF,
  savedText: '# A\n',
  dirty: false,
  ...overrides,
})

const text = (value: string): DiskRead => ({
  kind: 'text',
  name: 'SKILL.md',
  text: value,
})

type World = {
  disk: DiskRead
  session: FileSession<string> | null
  document: string | null
}

const setup = (overrides: Partial<World> = {}) => {
  const world: World = {
    disk: text('# A, by an agent\n'),
    session: session(),
    document: '# A\n',
    ...overrides,
  }
  const reload = vi.fn()
  const notice = vi.fn()
  const readDisk = vi.fn(async () => world.disk)
  const check = createExternalCheck<string>({
    readDisk,
    session: () => world.session,
    document: () => world.document,
    reload,
    notice,
  })
  return { world, check, reload, notice, readDisk }
}

describe('createExternalCheck', () => {
  it('reloads a clean Document with the text just read', async () => {
    const { check, reload, notice } = setup()
    await check.run(REF)
    expect(reload).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledWith({
      name: 'SKILL.md',
      text: '# A, by an agent\n',
      ref: REF,
    })
    expect(notice).not.toHaveBeenCalled()
  })

  it('shows the notice, and does not reload, when the Document is dirty', async () => {
    const { check, reload, notice } = setup({
      session: session({ dirty: true }),
      document: '# A, mine\n',
    })
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).toHaveBeenCalledWith({ name: 'SKILL.md', ref: REF })
  })

  it('does nothing when the disk holds the saved text, and clears a stale notice', async () => {
    const { check, reload, notice } = setup({ disk: text('# A\n') })
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).toHaveBeenCalledWith(null)
  })

  it('ignores the text a Save is writing while it is in flight', async () => {
    const { check, reload, notice } = setup({
      disk: text('# A, mine\n'),
      session: session({ dirty: true }),
      document: '# A, mine\n',
    })
    check.saving('# A, mine\n')
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).not.toHaveBeenCalled()
  })

  it('stops ignoring the written text once the Save has ended', async () => {
    const { check, notice } = setup({
      disk: text('# A, by an agent\n'),
      session: session({ dirty: true }),
      document: '# A, mine\n',
    })
    check.saving('# A, by an agent\n')
    check.saving(null)
    await check.run(REF)
    expect(notice).toHaveBeenCalledWith({ name: 'SKILL.md', ref: REF })
  })

  it('does not nag about a disk text it already told about', async () => {
    const { check, notice } = setup({
      session: session({ dirty: true }),
      document: '# A, mine\n',
    })
    await check.run(REF)
    await check.run(REF)
    expect(notice).toHaveBeenCalledTimes(1)
  })

  it('tells again when the disk changes once more', async () => {
    const { world, check, notice } = setup({
      session: session({ dirty: true }),
      document: '# A, mine\n',
    })
    await check.run(REF)
    world.disk = text('# A, by an agent, again\n')
    await check.run(REF)
    expect(notice).toHaveBeenCalledTimes(2)
  })

  it('tells again about the same disk text once the file was opened or saved', async () => {
    const { check, notice } = setup({
      session: session({ dirty: true }),
      document: '# A, mine\n',
    })
    await check.run(REF)
    check.forget()
    await check.run(REF)
    expect(notice).toHaveBeenCalledTimes(2)
  })

  it('drops the answer when another file was opened during the read', async () => {
    const { world, check, reload, notice } = setup()
    world.session = session({ ref: '/skills/b/SKILL.md' })
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).not.toHaveBeenCalled()
  })

  it('decides on the Document as it is after the read, not before', async () => {
    const world: World = {
      disk: text('# A, by an agent\n'),
      session: session(),
      document: '# A\n',
    }
    const reload = vi.fn()
    const notice = vi.fn()
    const check = createExternalCheck<string>({
      readDisk: async () => {
        world.session = session({ dirty: true })
        world.document = '# A, typed meanwhile\n'
        return world.disk
      },
      session: () => world.session,
      document: () => world.document,
      reload,
      notice,
    })
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).toHaveBeenCalledWith({ name: 'SKILL.md', ref: REF })
  })

  it.each([
    ['gone', { kind: 'gone' } as DiskRead],
    ['unreadable', { kind: 'unreadable' } as DiskRead],
  ])('shows the notice for a file that is %s', async (_label, disk) => {
    const { check, reload, notice } = setup({ disk })
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).toHaveBeenCalledWith({ name: 'SKILL.md', ref: REF })
  })

  it('does nothing without a file open or an editor', async () => {
    const without = setup({ session: null })
    await without.check.run(REF)
    const noEditor = setup({ document: null })
    await noEditor.check.run(REF)
    for (const { reload, notice } of [without, noEditor]) {
      expect(reload).not.toHaveBeenCalled()
      expect(notice).not.toHaveBeenCalled()
    }
  })

  it('survives a read that throws', async () => {
    const { check, reload, notice, readDisk } = setup()
    readDisk.mockRejectedValueOnce(new Error('IPC closed'))
    await check.run(REF)
    expect(reload).not.toHaveBeenCalled()
    expect(notice).not.toHaveBeenCalled()
    await check.run(REF)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reads again after a change that arrived during a read', async () => {
    const { world, check, reload, readDisk } = setup()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    readDisk.mockImplementationOnce(async () => {
      await gate
      return text('# A, first\n')
    })
    const first = check.run(REF)
    void check.run(REF)
    world.disk = text('# A, second\n')
    release()
    await first
    expect(readDisk).toHaveBeenCalledTimes(2)
    expect(reload).toHaveBeenLastCalledWith({
      name: 'SKILL.md',
      text: '# A, second\n',
      ref: REF,
    })
  })
})
