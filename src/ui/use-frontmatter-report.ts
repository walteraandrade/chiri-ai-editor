import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentControls } from '../editor/document-controls'
import {
  type FrontmatterContext,
  inspectFrontmatter,
  isSameReport,
} from '../skills/frontmatter-panel'

export const useFrontmatterReport = (
  initialText: string,
  controls: DocumentControls | null,
  { fileName, folderName }: FrontmatterContext,
) => {
  const [report, setReport] = useState(() =>
    inspectFrontmatter(initialText, { fileName, folderName }),
  )
  const context = useRef<FrontmatterContext>({ fileName, folderName })

  const refresh = useCallback((text: string) => {
    const next = inspectFrontmatter(text, context.current)
    setReport((previous) => (isSameReport(previous, next) ? previous : next))
  }, [])

  useEffect(() => {
    context.current = { fileName, folderName }
    const text = controls?.text()
    if (text !== undefined) refresh(text)
  }, [fileName, folderName, controls, refresh])

  return { report, refresh }
}
