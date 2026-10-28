import { useEffect, useRef } from 'react'
import { createEditorView } from '../editor/create-editor-view'

type EditorPaneProps = {
  readonly initialDoc: string
  readonly onChange: (doc: string) => void
}

export function EditorPane({ initialDoc, onChange }: EditorPaneProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const initialDocRef = useRef(initialDoc)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return undefined
    const view = createEditorView({
      parent,
      doc: initialDocRef.current,
      onChange: (doc) => onChangeRef.current(doc),
    })
    return () => view.destroy()
  }, [])

  return <div ref={parentRef} />
}
