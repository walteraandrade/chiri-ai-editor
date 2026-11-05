import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import {
  createDocumentLifecycle,
  type LifecycleHistory,
} from '../document/document-lifecycle'
import type { LeaveChoice } from '../document/leave-guard'
import type { DocumentControls } from '../editor/document-controls'
import type {
  DocumentFiles,
  ExternalKit,
  StartFile,
  UnsavedText,
} from '../platform/kit'
import { fileCommandOf } from './file-commands'
import { detectApplePlatform } from './platform'

type MarkdownFileOptions<Ref> = {
  readonly files: DocumentFiles<Ref>
  readonly unsavedText: UnsavedText<Ref>
  readonly history: LifecycleHistory<Ref>
  readonly start: StartFile<Ref> | null
  readonly external: ExternalKit<Ref> | undefined
  readonly controls: DocumentControls | null
  readonly notify: (text: string) => void
  readonly onReplaced: () => void
  readonly askLeave: (name: string) => Promise<LeaveChoice>
}

export const useMarkdownFile = <Ref>({
  files,
  unsavedText,
  history,
  start,
  external,
  controls,
  notify,
  onReplaced,
  askLeave,
}: MarkdownFileOptions<Ref>) => {
  const latest = useRef({ controls, notify, onReplaced })

  useEffect(() => {
    latest.current = { controls, notify, onReplaced }
  }, [controls, notify, onReplaced])

  const startRef = useRef(start)
  const lifecycle = useMemo(
    () =>
      createDocumentLifecycle<Ref>({
        files,
        unsavedText,
        history,
        start: startRef.current,
        ...(external !== undefined && { external }),
        editor: () => latest.current.controls,
        notify: (text) => latest.current.notify(text),
        askLeave,
        onReplaced: () => latest.current.onReplaced(),
      }),
    [files, unsavedText, history, external, askLeave],
  )

  const { session, conflict } = useSyncExternalStore(
    lifecycle.subscribe,
    lifecycle.snapshot,
  )

  useEffect(() => lifecycle.start(), [lifecycle])

  useEffect(() => {
    const apple = detectApplePlatform()
    const onKeyDown = (event: KeyboardEvent): void => {
      const command = fileCommandOf(event, apple)
      if (command === null) return
      event.preventDefault()
      if (event.repeat) return
      if (command === 'open') void lifecycle.open()
      else void lifecycle.save(command === 'save-as')
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [lifecycle])

  const name = session?.name
  const dirty = session?.dirty ?? false
  useEffect(() => {
    document.title =
      name === undefined ? 'Chiri' : `${dirty ? '• ' : ''}${name} · Chiri`
  }, [name, dirty])

  const { open, openRef, openCreated, save, edited, restore } = lifecycle
  const reloadFromDisk = useCallback(
    () => lifecycle.resolveConflict('reload'),
    [lifecycle],
  )
  const keepMine = useCallback(
    () => lifecycle.resolveConflict('keep'),
    [lifecycle],
  )

  return {
    session,
    conflict,
    open,
    openRef,
    openCreated,
    save,
    edited,
    restore,
    reloadFromDisk,
    keepMine,
  }
}
