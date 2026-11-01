import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Conflict,
  createFileActions,
  type FileEvent,
} from '../document/file-actions'
import {
  type FileSession,
  type FileSessionEvent,
  nextFileSession,
} from '../document/file-session'
import type { LeaveChoice } from '../document/leave-guard'
import type { DocumentControls } from '../editor/document-controls'
import type { DocumentFiles, StartFile, UnsavedText } from '../platform/kit'
import { fileCommandOf } from './file-commands'
import { detectApplePlatform } from './platform'

export type FileArrival<Ref> = FileEvent & { readonly ref: Ref | null }

type MarkdownFileOptions<Ref> = {
  readonly files: DocumentFiles<Ref>
  readonly unsavedText: UnsavedText<Ref>
  readonly start: StartFile<Ref> | null
  readonly controls: DocumentControls | null
  readonly notify: (text: string) => void
  readonly onOpened: (file: FileArrival<Ref>) => void
  readonly onSaving: (text: string) => void
  readonly onSaved: (file: FileArrival<Ref>) => void
  readonly askLeave: (name: string) => Promise<LeaveChoice>
}

const startSession = <Ref>(
  start: StartFile<Ref> | null,
  text: string,
): FileSession<Ref> | null =>
  start === null
    ? null
    : {
        name: start.name,
        ref: start.ref,
        savedText: start.savedText,
        dirty: text !== start.savedText,
      }

const startConflict = <Ref>(
  start: StartFile<Ref> | null,
): Conflict<Ref> | null =>
  start?.diskChanged && start.ref !== null
    ? { name: start.name, ref: start.ref }
    : null

export const useMarkdownFile = <Ref>({
  files,
  unsavedText,
  start,
  controls,
  notify,
  onOpened,
  onSaving,
  onSaved,
  askLeave,
}: MarkdownFileOptions<Ref>) => {
  const [session, setSession] = useState(() =>
    startSession(start, unsavedText.initial),
  )
  const [conflict, setConflict] = useState(() => startConflict(start))
  const sessionRef = useRef(session)
  const latest = useRef({ controls, notify, onOpened, onSaving, onSaved })

  useEffect(() => {
    latest.current = { controls, notify, onOpened, onSaving, onSaved }
  }, [controls, notify, onOpened, onSaving, onSaved])

  const dispatch = useCallback((event: FileSessionEvent<Ref>) => {
    sessionRef.current = nextFileSession(sessionRef.current, event)
    setSession(sessionRef.current)
  }, [])

  const actions = useMemo(() => {
    const announce = (): void => {
      const text = latest.current.controls?.text()
      if (text !== undefined) unsavedText.changed(text, sessionRef.current)
    }
    return createFileActions({
      files,
      offered: unsavedText.offered,
      editor: () => latest.current.controls,
      session: () => sessionRef.current,
      dispatch,
      notify: (text) => latest.current.notify(text),
      onSaving: (text) => latest.current.onSaving(text),
      onOpened: (file) => {
        setConflict(null)
        latest.current.onOpened({
          ...file,
          ref: sessionRef.current?.ref ?? null,
        })
        announce()
      },
      onSaved: (file) => {
        setConflict(null)
        latest.current.onSaved({
          ...file,
          ref: sessionRef.current?.ref ?? null,
        })
        announce()
      },
      onConflict: setConflict,
      ...(unsavedText.discard !== undefined && {
        leave: {
          ask: askLeave,
          discard: unsavedText.discard,
          initialText: unsavedText.initial,
        },
      }),
    })
  }, [files, unsavedText, dispatch, askLeave])

  const { open, openRef, save, reload } = actions

  const edited = useCallback(
    (text: string) => {
      dispatch({ type: 'edited', text })
      unsavedText.changed(text, sessionRef.current)
    },
    [dispatch, unsavedText],
  )

  const reloadFromDisk = useCallback(() => {
    if (conflict !== null) void reload(conflict)
  }, [conflict, reload])

  const keepMine = useCallback(() => setConflict(null), [])

  useEffect(() => {
    const apple = detectApplePlatform()
    const onKeyDown = (event: KeyboardEvent): void => {
      const command = fileCommandOf(event, apple)
      if (command === null) return
      event.preventDefault()
      if (event.repeat) return
      if (command === 'open') void open()
      else void save(command === 'save-as')
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [open, save])

  const name = session?.name
  const dirty = session?.dirty ?? false
  useEffect(() => {
    document.title =
      name === undefined ? 'Chiri' : `${dirty ? '• ' : ''}${name} · Chiri`
  }, [name, dirty])

  return {
    session,
    conflict,
    open,
    openRef,
    save,
    edited,
    reloadFromDisk,
    keepMine,
  }
}
