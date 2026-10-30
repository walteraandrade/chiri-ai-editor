import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { browserFileFallback, browserFileHost } from '../document/browser-files'
import {
  type MarkdownFileHandle,
  openMarkdownFile,
  saveMarkdownFile,
} from '../document/file-access'
import { nextFileSession } from '../document/file-session'
import { suggestedFileName } from '../document/markdown-file'
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
  const sessionRef = useRef(session)
  const inputRef = useRef<HTMLInputElement>(null)
  const fallback = useMemo(
    () => browserFileFallback(() => inputRef.current),
    [],
  )

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const open = useCallback(async () => {
    if (controls === null) return
    try {
      const opened = await openMarkdownFile(browserFileHost(), fallback)
      if (opened === null) return
      controls.replace(opened.text)
      dispatch({ type: 'opened', ...opened })
      notify(`Opened ${opened.name}`)
    } catch {
      notify('Could not open the file')
    }
  }, [controls, fallback, notify])

  const save = useCallback(
    async (saveAs: boolean) => {
      if (controls === null) return
      const text = controls.text()
      const current = sessionRef.current
      const name = current?.name ?? suggestedFileName(text)
      try {
        const saved = await saveMarkdownFile(browserFileHost(), fallback, {
          text,
          handle: current?.handle ?? null,
          name,
          saveAs,
        })
        if (saved === null) return
        dispatch({
          type: 'saved',
          name: saved.name,
          handle: saved.handle,
          text,
          current: controls.text(),
        })
        notify(
          `${saved.method === 'download' ? 'Downloaded' : 'Saved'} ${saved.name}`,
        )
      } catch {
        notify(`Could not save ${name}`)
      }
    },
    [controls, fallback, notify],
  )

  const edited = useCallback(
    (text: string) => dispatch({ type: 'edited', text }),
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
