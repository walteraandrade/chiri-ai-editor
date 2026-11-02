import type { DocumentFiles, FileContents, OpenResult } from '../platform/kit'
import type { FileSession, FileSessionEvent } from './file-session'
import { confirmLeave, type LeaveOptions } from './leave-guard'
import { suggestedFileName } from './markdown-file'
import { restoreUnsaved, type Unsaved } from './unsaved'

export type EditorText = {
  readonly text: () => string
  readonly replace: (text: string) => void
  readonly refresh: (text: string) => void
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
  readonly onSaveEnded?: () => void
  readonly onOpened?: (file: FileEvent) => void
  readonly onReloaded?: (file: FileEvent) => void
  readonly onSaved?: (file: FileEvent) => void
  readonly onConflict?: (conflict: Conflict<Ref>) => void
  readonly leave?: LeaveOptions<Ref>
}

export type CreatedFile<Ref, T> = {
  readonly ref: Ref | null
  readonly value: T
}

export type OpenCreated<T> =
  | { readonly kind: 'stayed' }
  | { readonly kind: 'prepared'; readonly value: T }

export type FileActions<Ref> = {
  readonly open: () => Promise<void>
  readonly openRef: (ref: Ref) => Promise<void>
  readonly openCreated: <T>(
    prepare: () => Promise<CreatedFile<Ref, T>>,
  ) => Promise<OpenCreated<T>>
  readonly save: (saveAs: boolean) => Promise<boolean>
  readonly reload: (conflict: Conflict<Ref>) => Promise<void>
  readonly reloadFrom: (file: FileContents<Ref>) => void
}

const STAYED = { kind: 'cancelled' } as const

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
  onSaveEnded,
  onOpened,
  onReloaded,
  onSaved,
  onConflict,
  leave,
}: FileActionsOptions<Ref>): FileActions<Ref> => {
  const unsavedFor = async (ref: Ref | null): Promise<Unsaved | null> => {
    if (ref === null) return null
    try {
      return await offered(ref)
    } catch {
      return null
    }
  }

  const afterLeaving = async (
    result: OpenResult<Ref>,
    current: EditorText,
  ): Promise<OpenResult<Ref>> => {
    if (result.kind !== 'opened' || leave === undefined) return result
    const outcome = await confirmLeave({
      session: session(),
      text: current.text(),
      leave,
      save: () => save(false),
    })
    if (outcome === 'stay') return STAYED
    const { ref } = result.file
    return outcome === 'saved' && ref !== null && session()?.ref === ref
      ? files.read(ref)
      : result
  }

  const arrive = async (
    result: OpenResult<Ref>,
    current: EditorText,
    {
      keepUnsaved,
      guarded,
      failure,
      done,
      reloaded,
    }: {
      readonly keepUnsaved: boolean
      readonly guarded: boolean
      readonly failure: (reason: string | undefined) => string
      readonly done: string
      readonly reloaded: boolean
    },
  ): Promise<void> => {
    const settled = guarded ? await afterLeaving(result, current) : result
    if (settled.kind === 'cancelled') return
    if (settled.kind === 'failed') {
      notify(failure(settled.reason))
      return
    }
    const { name, text, ref } = settled.file
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
    const arrived = reloaded ? onReloaded : onOpened
    arrived?.({ text: arrival.text, name })
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
      guarded: true,
      failure: (reason) => withReason('Could not open the file', reason),
      done: 'Opened',
      reloaded: false,
    })
  }

  const openRef = async (ref: Ref): Promise<void> => {
    const current = editor()
    if (current === null || session()?.ref === ref) return
    await arrive(await files.read(ref), current, {
      keepUnsaved: true,
      guarded: true,
      failure: (reason) => withReason('Could not open the file', reason),
      done: 'Opened',
      reloaded: false,
    })
  }

  const openCreated = async <T>(
    prepare: () => Promise<CreatedFile<Ref, T>>,
  ): Promise<OpenCreated<T>> => {
    const current = editor()
    if (current === null) return { kind: 'stayed' }
    if (leave !== undefined) {
      const outcome = await confirmLeave({
        session: session(),
        text: current.text(),
        leave,
        save: () => save(false),
      })
      if (outcome === 'stay') return { kind: 'stayed' }
    }
    const created = await prepare()
    if (created.ref !== null)
      await arrive(await files.read(created.ref), current, {
        keepUnsaved: false,
        guarded: false,
        failure: (reason) => withReason('Could not open the file', reason),
        done: 'Opened',
        reloaded: false,
      })
    return { kind: 'prepared', value: created.value }
  }

  const reload = async ({ name, ref }: Conflict<Ref>): Promise<void> => {
    const current = editor()
    if (current === null) return
    await arrive(await files.read(ref), current, {
      keepUnsaved: false,
      guarded: false,
      failure: (reason) => withReason(`Could not reload ${name}`, reason),
      done: 'Reloaded',
      reloaded: true,
    })
  }

  const reloadFrom = ({ name, text, ref }: FileContents<Ref>): void => {
    const current = editor()
    if (current === null) return
    dispatch({ type: 'opened', name, ref, text, savedText: text })
    current.refresh(text)
    onReloaded?.({ text, name })
    notify(`Reloaded ${name}: it changed on disk`)
  }

  const writeFile = async (saveAs: boolean): Promise<boolean> => {
    const current = editor()
    if (current === null) return false
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
    if (result.kind === 'cancelled') return false
    if (result.kind === 'failed') {
      notify(withReason(`Could not save ${name}`, result.reason))
      return false
    }
    if (result.kind === 'conflict') {
      if (file?.ref != null) onConflict?.({ name, ref: file.ref })
      else notify(`Could not save ${name}: the file changed on disk`)
      return false
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
    return true
  }

  const save = async (saveAs: boolean): Promise<boolean> => {
    try {
      return await writeFile(saveAs)
    } finally {
      onSaveEnded?.()
    }
  }

  return { open, openRef, openCreated, save, reload, reloadFrom }
}
