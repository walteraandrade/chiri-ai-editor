import type {
  ChiriApi,
  FileReadResult,
  FileSaveResult,
} from '../../electron/api'
import { createExclusive } from '../document/exclusive'
import type { DocumentFiles, OpenResult, SaveResult } from './kit'

export type FilesApi = Pick<
  ChiriApi,
  'openFile' | 'readFile' | 'saveFile' | 'saveFileAs'
>

const CANCELLED = { kind: 'cancelled' } as const
const FAILED = { kind: 'failed' } as const

const toOpenResult = (result: FileReadResult): OpenResult<string> =>
  result.kind === 'opened'
    ? {
        kind: 'opened',
        file: { name: result.name, text: result.text, ref: result.path },
      }
    : result

const toSaveResult = (result: FileSaveResult): SaveResult<string> =>
  result.kind === 'saved'
    ? {
        kind: 'saved',
        name: result.name,
        ref: result.path,
        method: 'write',
      }
    : result

export const createElectronFiles = (api: FilesApi): DocumentFiles<string> => {
  const exclusive = createExclusive()

  const guarded = <A, B>(
    call: () => Promise<A>,
    convert: (answer: A) => B,
  ): Promise<B | typeof CANCELLED | typeof FAILED> =>
    exclusive<B | typeof CANCELLED | typeof FAILED>(async () => {
      try {
        return convert(await call())
      } catch {
        return FAILED
      }
    }, CANCELLED)

  return {
    open: () => guarded(api.openFile, toOpenResult),
    read: (path) => guarded(() => api.readFile(path), toOpenResult),
    save: ({ text, ref, name, expected, saveAs }) =>
      guarded(
        () =>
          ref !== null && expected !== null && !saveAs
            ? api.saveFile({ path: ref, text, expected })
            : api.saveFileAs({ text, suggestedName: name }),
        toSaveResult,
      ),
  }
}
