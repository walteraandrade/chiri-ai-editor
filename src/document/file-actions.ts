import type { DocumentFiles, OpenResult } from '../platform/kit'
import type { FileSession, FileSessionEvent } from './file-session'
import { suggestedFileName } from './markdown-file'
import { restoreUnsaved, type Unsaved } from './unsaved'

export type EditorText = {
  readonly text: () => string
  readonly replace: (text: string) => void
}

export type Conflict<Ref> = {
  readonly name: string
  readonly ref: Ref
}

export type FileEvent = {
  readonly text: string
  readonly name: string
}

type FileActionsOptions<Ref> = {
  readonly files: DocumentFiles<Ref>
  readonly offered: (ref: Ref) => Promise<Unsaved | null>
  readonly editor: () => EditorText | null
  readonly session: () => FileSession<Ref> | null
  readonly dispatch: (event: FileSessionEvent<Ref>) => void
  readonly notify: (text: string) => void
  readonly onSaving?: (text: string) => void
  readonly onOpened?: (file: FileEvent) => void
  readonly onSaved?: (file: FileEvent) => void
  readonly onConflict?: (conflict: Conflict<Ref>) => void
}

export type FileActions<Ref> = {
  readonly open: () => Promise<void>
  readonly save: (saveAs: boolean) => Promise<void>
  readonly reload: (conflict: Conflict<Ref>) => Promise<void>
}

const withReason = (text: string, reason: string | undefined): string =>
  reason === undefined ? text : `${text}: ${reason}`

export const createFileActions = <Ref>({
  files,
  offered,
  editor,
  session,
  dispatch,
  notify,
  onSaving,
  onOpened,
  onSaved,
  onConflict,
}: FileActionsOptions<Ref>): FileActions<Ref> => {
  const unsavedFor = async (ref: Ref | null): Promise<Unsaved | null> => {
    if (ref === null) return null
    try {
      return await offered(ref)
    } catch {
      return null
    }
  }

  const arrive = async (
    result: OpenResult<Ref>,
    current: EditorText,
    {
      keepUnsaved,
      failure,
      done,
    }: {
      readonly keepUnsaved: boolean
      readonly failure: (reason: string | undefined) => string
      readonly done: string
    },
  ): Promise<void> => {
    if (result.kind === 'cancelled') return
    if (result.kind === 'failed') {
      notify(failure(result.reason))
      return
    }
    const { name, text, ref } = result.file
    const arrival = restoreUnsaved(
      text,
      keepUnsaved ? await unsavedFor(ref) : null,
    )
    dispatch({
      type: 'opened',
      name,
      ref,
      text: arrival.text,
      savedText: arrival.savedText,
    })
    current.replace(arrival.text)
    onOpened?.({ text: arrival.text, name })
    notify(
      arrival.restored
        ? `Restored unsaved changes to ${name}`
        : `${done} ${name}`,
    )
    if (arrival.diskChanged && ref !== null) onConflict?.({ name, ref })
  }

  const open = async (): Promise<void> => {
    const current = editor()
    if (current === null) return
    await arrive(await files.open(), current, {
      keepUnsaved: true,
      failure: (reason) => withReason('Could not open the file', reason),
      done: 'Opened',
    })
  }

  const reload = async ({ name, ref }: Conflict<Ref>): Promise<void> => {
    const current = editor()
    if (current === null) return
    await arrive(await files.read(ref), current, {
      keepUnsaved: false,
      failure: (reason) => withReason(`Could not reload ${name}`, reason),
      done: 'Reloaded',
    })
  }

  const save = async (saveAs: boolean): Promise<void> => {
    const current = editor()
    if (current === null) return
    const text = current.text()
    onSaving?.(text)
    const file = session()
    const name = file?.name ?? suggestedFileName(text)
    const result = await files.save({
      text,
      ref: file?.ref ?? null,
      name,
      expected: file?.savedText ?? null,
      saveAs,
    })
    if (result.kind === 'cancelled') return
    if (result.kind === 'failed') {
      notify(withReason(`Could not save ${name}`, result.reason))
      return
    }
    if (result.kind === 'conflict') {
      if (file?.ref != null) onConflict?.({ name, ref: file.ref })
      else notify(`Could not save ${name}: the file changed on disk`)
      return
    }
    dispatch({
      type: 'saved',
      name: result.name,
      ref: result.ref,
      text,
      current: current.text(),
    })
    onSaved?.({ text, name: result.name })
    notify(
      `${result.method === 'download' ? 'Downloaded' : 'Saved'} ${result.name}`,
    )
  }

  return { open, save, reload }
}
