import { useEffect, useRef } from 'react'
import { createEditorView } from '../editor/create-editor-view'

type EditorPaneProps = {
  readonly initialDoc: string
  readonly onChange: (doc: string) => void
}

export function EditorPane({ initialDoc, onChange }: EditorPaneProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return undefined
    const view = createEditorView({
      parent,
      doc: initialDoc,
      onChange: (doc) => onChangeRef.current(doc),
    })
    return () => view.destroy()
  }, [initialDoc])

  return <div ref={parentRef} />
}
