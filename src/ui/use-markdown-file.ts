import { useEffect, useMemo, useReducer, useRef } from 'react'
import { browserFileFallback, browserFileHost } from '../document/browser-files'
import type { MarkdownFileHandle } from '../document/file-access'
import { createFileActions } from '../document/file-actions'
import { nextFileSession } from '../document/file-session'
import type { DocumentControls } from '../editor/document-controls'
import { fileCommandOf } from './file-commands'
import { detectApplePlatform } from './platform'

type MarkdownFileOptions = {
  readonly controls: DocumentControls | null
  readonly notify: (text: string) => void
}

export const useMarkdownFile = ({ controls, notify }: MarkdownFileOptions) => {
  const [session, dispatch] = useReducer(
    nextFileSession<MarkdownFileHandle>,
    null,
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const latest = useRef({ session, controls, notify })

  useEffect(() => {
    latest.current = { session, controls, notify }
  }, [session, controls, notify])

  const { open, save } = useMemo(
    () =>
      createFileActions({
        host: browserFileHost,
        fallback: browserFileFallback(() => inputRef.current),
        editor: () => latest.current.controls,
        session: () => latest.current.session,
        dispatch,
        notify: (text) => latest.current.notify(text),
      }),
    [],
  )

  const edited = useMemo(
    () => (text: string) => dispatch({ type: 'edited', text }),
    [],
  )

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

  return { session, inputRef, open, save, edited }
}
