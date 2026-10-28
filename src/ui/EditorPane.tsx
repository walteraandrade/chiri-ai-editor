import { useEffect, useRef } from 'react'
import { createLazyModelClient } from '../ai/lazy-client'
import { createEditorView } from '../editor/create-editor-view'
import { suggestionExtensions } from '../editor/suggestions'
import type { SuggestionNotice } from '../suggestions/types'

type EditorPaneProps = {
  readonly initialDoc: string
  readonly onChange: (doc: string) => void
  readonly onNotice: (notice: SuggestionNotice) => void
}

export function EditorPane({
  initialDoc,
  onChange,
  onNotice,
}: EditorPaneProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const initialDocRef = useRef(initialDoc)
  const onChangeRef = useRef(onChange)
  const onNoticeRef = useRef(onNotice)

  useEffect(() => {
    onChangeRef.current = onChange
    onNoticeRef.current = onNotice
  }, [onChange, onNotice])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return undefined
    const view = createEditorView({
      parent,
      doc: initialDocRef.current,
      onChange: (doc) => onChangeRef.current(doc),
      extensions: suggestionExtensions({
        client: createLazyModelClient(() =>
          import('../ai/browser-client').then((module) =>
            module.createBrowserModelClient(),
          ),
        ),
        onNotice: (notice) => onNoticeRef.current(notice),
      }),
    })
    return () => view.destroy()
  }, [])

  return <div ref={parentRef} />
}
