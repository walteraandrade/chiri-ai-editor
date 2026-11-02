import { describe, expect, it, vi } from 'vitest'
import type {
  ChiriApi,
  FileReadResult,
  FileSaveResult,
} from '../../electron/api'
import { createElectronFiles } from './electron-files'

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const PATH = '/skills/a/SKILL.md'

const readOk: FileReadResult = {
  kind: 'opened',
  path: PATH,
  name: 'SKILL.md',
  text: '# A\n',
}

const api = (overrides: Partial<ChiriApi> = {}) => ({
  openFile: vi.fn(async (): Promise<FileReadResult> => readOk),
  readFile: vi.fn(async (): Promise<FileReadResult> => readOk),
  saveFile: vi.fn(
    async (): Promise<FileSaveResult> => ({
      kind: 'saved',
      path: PATH,
      name: 'SKILL.md',
    }),
  ),
  saveFileAs: vi.fn(
    async (): Promise<FileSaveResult> => ({
      kind: 'saved',
      path: '/other/copy.md',
      name: 'copy.md',
    }),
  ),
  ...overrides,
})

const request = {
  text: '# A, edited\n',
  ref: PATH,
  name: 'SKILL.md',
  expected: '# A\n',
  saveAs: false,
}

describe('open and read', () => {
  it('opens with the real path as the ref', async () => {
    expect(await createElectronFiles(api()).open()).toEqual({
      kind: 'opened',
      file: { name: 'SKILL.md', text: '# A\n', ref: PATH },
    })
  })

  it('reads a path again', async () => {
    const native = api()
    expect(await createElectronFiles(native).read(PATH)).toEqual({
      kind: 'opened',
      file: { name: 'SKILL.md', text: '# A\n', ref: PATH },
    })
    expect(native.readFile).toHaveBeenCalledWith(PATH)
  })

  it('passes cancelled and failed through as values', async () => {
    const cancelled = createElectronFiles(
      api({ openFile: async () => ({ kind: 'cancelled' }) }),
    )
    expect(await cancelled.open()).toEqual({ kind: 'cancelled' })
    const failed = createElectronFiles(
      api({
        readFile: async () => ({ kind: 'failed', reason: 'File not found' }),
      }),
    )
    expect(await failed.read(PATH)).toEqual({
      kind: 'failed',
      reason: 'File not found',
    })
  })

  it('turns a rejected call into a failure', async () => {
    const files = createElectronFiles(
      api({
        openFile: async () => {
          throw new Error('IPC closed')
        },
      }),
    )
    expect(await files.open()).toEqual({ kind: 'failed' })
  })
})

describe('save', () => {
  it('writes in place with the text last read or written', async () => {
    const native = api()
    expect(await createElectronFiles(native).save(request)).toEqual({
      kind: 'saved',
      name: 'SKILL.md',
      ref: PATH,
      method: 'write',
    })
    expect(native.saveFile).toHaveBeenCalledWith({
      path: PATH,
      text: '# A, edited\n',
      expected: '# A\n',
    })
    expect(native.saveFileAs).not.toHaveBeenCalled()
  })

  it('reports a conflict as a value', async () => {
    const files = createElectronFiles(
      api({ saveFile: async () => ({ kind: 'conflict' }) }),
    )
    expect(await files.save(request)).toEqual({ kind: 'conflict' })
  })

  it('reports a failure with its reason', async () => {
    const files = createElectronFiles(
      api({
        saveFile: async () => ({ kind: 'failed', reason: 'Permission denied' }),
      }),
    )
    expect(await files.save(request)).toEqual({
      kind: 'failed',
      reason: 'Permission denied',
    })
  })

  it('asks for a place with no ref, suggesting the name', async () => {
    const native = api()
    const result = await createElectronFiles(native).save({
      ...request,
      ref: null,
      expected: null,
      name: 'release-notes.md',
    })
    expect(native.saveFileAs).toHaveBeenCalledWith({
      text: '# A, edited\n',
      suggestedName: 'release-notes.md',
    })
    expect(result).toEqual({
      kind: 'saved',
      name: 'copy.md',
      ref: '/other/copy.md',
      method: 'write',
    })
  })

  it('asks for a place on Save as, even with a ref', async () => {
    const native = api()
    await createElectronFiles(native).save({ ...request, saveAs: true })
    expect(native.saveFileAs).toHaveBeenCalledTimes(1)
    expect(native.saveFile).not.toHaveBeenCalled()
  })

  it('turns a rejected call into a failure', async () => {
    const files = createElectronFiles(
      api({
        saveFile: async () => {
          throw new Error('IPC closed')
        },
      }),
    )
    expect(await files.save(request)).toEqual({ kind: 'failed' })
  })
})

describe('one file action at a time', () => {
  it('ignores a call that comes while another waits', async () => {
    const dialog = deferred<FileReadResult>()
    const native = api({ openFile: () => dialog.promise })
    const files = createElectronFiles(native)
    const first = files.open()
    expect(await files.save(request)).toEqual({ kind: 'cancelled' })
    expect(await files.open()).toEqual({ kind: 'cancelled' })
    expect(native.saveFile).not.toHaveBeenCalled()
    dialog.resolve(readOk)
    expect(await first).toMatchObject({ kind: 'opened' })
    expect(await files.read(PATH)).toMatchObject({ kind: 'opened' })
  })
})
