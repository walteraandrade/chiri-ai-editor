import type { DocumentFiles, OpenResult, SaveResult } from '../platform/kit'
import { createExclusive } from './exclusive'
import {
  type FileFallback,
  type FileHost,
  type MarkdownFileHandle,
  type OpenedFile,
  openMarkdownFile,
  readHandle,
  saveMarkdownFile,
  supportsFileHandles,
} from './file-access'

type WebFilesOptions = {
  readonly host: () => FileHost
  readonly fallback: FileFallback
}

type Ref = MarkdownFileHandle

const CANCELLED = { kind: 'cancelled' } as const
const FAILED = { kind: 'failed' } as const

const opened = (file: OpenedFile): OpenResult<Ref> => ({
  kind: 'opened',
  file: { name: file.name, text: file.text, ref: file.handle },
})

export const createWebFiles = ({
  host,
  fallback,
}: WebFilesOptions): DocumentFiles<Ref> => {
  const exclusive = createExclusive()

  const pickerTask = <T>(
    target: FileHost,
    task: () => Promise<T>,
    whenBusy: T,
  ): Promise<T> =>
    // The file input may never report a cancel, so only the pickers lock.
    supportsFileHandles(target) ? exclusive(task, whenBusy) : task()

  const open = (): Promise<OpenResult<Ref>> => {
    const target = host()
    return pickerTask<OpenResult<Ref>>(
      target,
      async () => {
        try {
          const file = await openMarkdownFile(target, fallback)
          return file === null ? CANCELLED : opened(file)
        } catch {
          return FAILED
        }
      },
      CANCELLED,
    )
  }

  const read = async (ref: Ref): Promise<OpenResult<Ref>> => {
    try {
      return opened(await readHandle(ref))
    } catch {
      return FAILED
    }
  }

  const save: DocumentFiles<Ref>['save'] = ({ text, ref, name, saveAs }) => {
    const target = host()
    return pickerTask<SaveResult<Ref>>(
      target,
      async () => {
        try {
          const saved = await saveMarkdownFile(target, fallback, {
            text,
            handle: ref,
            name,
            saveAs,
          })
          return saved === null
            ? CANCELLED
            : {
                kind: 'saved',
                name: saved.name,
                ref: saved.handle,
                method: saved.method,
              }
        } catch {
          return FAILED
        }
      },
      CANCELLED,
    )
  }

  return { open, read, save }
}
