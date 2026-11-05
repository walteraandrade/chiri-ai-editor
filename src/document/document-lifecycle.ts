import type { SwitchableHistory } from '../history/hub'
import type { VersionId } from '../history/types'
import type {
  DocumentFiles,
  ExternalKit,
  StartFile,
  UnsavedText,
} from '../platform/kit'
import { createExternalCheck } from './external-check'
import {
  type Conflict,
  createFileActions,
  type EditorText,
  type FileActions,
} from './file-actions'
import {
  type FileSession,
  type FileSessionEvent,
  nextFileSession,
} from './file-session'
import type { LeaveChoice } from './leave-guard'

export type LifecycleEditor = EditorText & {
  readonly restore: (text: string) => void
}

export type LifecycleHistory<Ref> = Pick<
  SwitchableHistory<Ref>,
  | 'select'
  | 'replaced'
  | 'opened'
  | 'external'
  | 'restored'
  | 'saving'
  | 'saved'
>

export type LifecycleState<Ref> = {
  readonly session: FileSession<Ref> | null
  readonly conflict: Conflict<Ref> | null
}

type LifecycleOptions<Ref> = {
  readonly files: DocumentFiles<Ref>
  readonly unsavedText: UnsavedText<Ref>
  readonly history: LifecycleHistory<Ref>
  readonly start: StartFile<Ref> | null
  readonly external?: ExternalKit<Ref>
  readonly editor: () => LifecycleEditor | null
  readonly notify: (text: string) => void
  readonly askLeave: (name: string) => Promise<LeaveChoice>
  readonly onReplaced: () => void
}

export type DocumentLifecycle<Ref> = Pick<
  FileActions<Ref>,
  'open' | 'openRef' | 'openCreated' | 'save'
> & {
  readonly snapshot: () => LifecycleState<Ref>
  readonly subscribe: (listener: () => void) => () => void
  readonly watchDisk: () => () => void
  readonly edited: (text: string) => void
  readonly resolveConflict: (choice: 'reload' | 'keep') => void
  readonly restore: (from: VersionId, text: string) => boolean
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

export const createDocumentLifecycle = <Ref>({
  files,
  unsavedText,
  history,
  start: startFile,
  external,
  editor,
  notify,
  askLeave,
  onReplaced,
}: LifecycleOptions<Ref>): DocumentLifecycle<Ref> => {
  let state: LifecycleState<Ref> = {
    session: startSession(startFile, unsavedText.initial),
    conflict: startConflict(startFile),
  }
  const listeners = new Set<() => void>()

  const update = (next: Partial<LifecycleState<Ref>>): void => {
    const merged = { ...state, ...next }
    if (merged.session === state.session && merged.conflict === state.conflict)
      return
    state = merged
    for (const listener of listeners) listener()
  }

  const setConflict = (conflict: Conflict<Ref> | null): void =>
    update({ conflict })

  const dispatch = (event: FileSessionEvent<Ref>): void =>
    update({ session: nextFileSession(state.session, event) })

  const announce = (): void => {
    const text = editor()?.text()
    if (text !== undefined) unsavedText.changed(text, state.session)
  }

  const settleBefore = (current: LifecycleEditor, next: string): void => {
    const before = current.text()
    if (before !== next) history.replaced(before)
  }

  const settlingEditor = (): EditorText | null => {
    const current = editor()
    return current === null
      ? null
      : {
          text: current.text,
          replace: (next) => {
            settleBefore(current, next)
            current.replace(next)
          },
          refresh: (next) => {
            settleBefore(current, next)
            current.refresh(next)
          },
        }
  }

  const check =
    external === undefined
      ? null
      : createExternalCheck<Ref>({
          readDisk: external.readDisk,
          session: () => state.session,
          document: () => editor()?.text() ?? null,
          reload: (file) => actions.reloadFrom(file),
          notice: setConflict,
        })

  const arrived = (record: () => void): void => {
    setConflict(null)
    check?.forget()
    history.select(state.session?.ref ?? null)
    record()
  }

  const actions = createFileActions({
    files,
    offered: unsavedText.offered,
    editor: settlingEditor,
    session: () => state.session,
    dispatch,
    notify,
    onSaving: (text) => {
      check?.saving(text)
      history.saving(text)
    },
    onSaveEnded: () => check?.saving(null),
    onOpened: ({ text, name }) => {
      arrived(() => history.opened({ text, name }))
      onReplaced()
      announce()
    },
    onReloaded: ({ text }) => {
      arrived(() => history.external({ text }))
      onReplaced()
      announce()
    },
    onSaved: ({ text, name }) => {
      arrived(() => history.saved({ text, name }))
      announce()
    },
    onConflict: setConflict,
    ...(unsavedText.discard !== undefined && {
      leave: {
        ask: askLeave,
        discard: unsavedText.discard,
        untitledBaseline: unsavedText.untitledBaseline,
      },
    }),
  })

  const restore = (from: VersionId, text: string): boolean => {
    const current = editor()
    if (current === null) return false
    settleBefore(current, text)
    current.restore(text)
    history.restored({ text, from })
    onReplaced()
    return true
  }

  const watchDisk = (): (() => void) => {
    if (external === undefined || check === null) return () => undefined
    let watched: Ref | null | undefined
    const watch = (): void => {
      const ref = state.session?.ref ?? null
      if (ref === watched) return
      watched = ref
      external.watch(ref)
    }
    watch()
    listeners.add(watch)
    const unsubscribe = external.subscribe((change) => {
      const ref = state.session?.ref
      if (ref != null && change.touches(ref)) void check.run(ref)
    })
    return () => {
      listeners.delete(watch)
      unsubscribe()
    }
  }

  return {
    open: actions.open,
    openRef: actions.openRef,
    openCreated: actions.openCreated,
    save: actions.save,
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    watchDisk,
    edited: (text) => {
      dispatch({ type: 'edited', text })
      unsavedText.changed(text, state.session)
    },
    resolveConflict: (choice) => {
      if (choice === 'keep') setConflict(null)
      else if (state.conflict !== null) void actions.reload(state.conflict)
    },
    restore,
  }
}
