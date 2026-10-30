import {
  type FileFallback,
  type FileHost,
  type MarkdownFileHandle,
  openMarkdownFile,
  saveMarkdownFile,
  supportsFileHandles,
} from './file-access'
import type { FileSession, FileSessionEvent } from './file-session'
import { suggestedFileName } from './markdown-file'

export type EditorText = {
  readonly text: () => string
  readonly replace: (text: string) => void
}

type FileActionsOptions = {
  readonly host: () => FileHost
  readonly fallback: FileFallback
  readonly editor: () => EditorText | null
  readonly session: () => FileSession<MarkdownFileHandle> | null
  readonly dispatch: (event: FileSessionEvent<MarkdownFileHandle>) => void
  readonly notify: (text: string) => void
  readonly onSaving?: (text: string) => void
}

export type FileActions = {
  readonly open: () => Promise<void>
  readonly save: (saveAs: boolean) => Promise<void>
}

export const createFileActions = ({
  host,
  fallback,
  editor,
  session,
  dispatch,
  notify,
  onSaving,
}: FileActionsOptions): FileActions => {
  let busy = false

  const exclusive = async (
    task: (target: FileHost, current: EditorText) => Promise<void>,
  ): Promise<void> => {
    const current = editor()
    if (busy || current === null) return
    const target = host()
    // The file input may never report a cancel, so only the pickers lock.
    busy = supportsFileHandles(target)
    try {
      await task(target, current)
    } finally {
      busy = false
    }
  }

  const open = () =>
    exclusive(async (target, current) => {
      try {
        const opened = await openMarkdownFile(target, fallback)
        if (opened === null) return
        current.replace(opened.text)
        dispatch({ type: 'opened', ...opened })
        notify(`Opened ${opened.name}`)
      } catch {
        notify('Could not open the file')
      }
    })

  const save = (saveAs: boolean) =>
    exclusive(async (target, current) => {
      const text = current.text()
      onSaving?.(text)
      const file = session()
      const name = file?.name ?? suggestedFileName(text)
      try {
        const saved = await saveMarkdownFile(target, fallback, {
          text,
          handle: file?.handle ?? null,
          name,
          saveAs,
        })
        if (saved === null) return
        dispatch({
          type: 'saved',
          name: saved.name,
          handle: saved.handle,
          text,
          current: current.text(),
        })
        notify(
          `${saved.method === 'download' ? 'Downloaded' : 'Saved'} ${saved.name}`,
        )
      } catch {
        notify(`Could not save ${name}`)
      }
    })

  return { open, save }
}
