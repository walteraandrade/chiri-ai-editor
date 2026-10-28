import { useEffect, useRef } from 'react'
import { appendReviewDrop } from '../ai/dev-log'
import { createLazyModelClient } from '../ai/lazy-client'
import { createEditorView } from '../editor/create-editor-view'
import {
  bindReviewControls,
  type ReviewControls,
} from '../editor/review-controls'
import type { ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import { suggestionExtensions } from '../editor/suggestions'
import { spaceBelowHeader } from '../editor/tooltip-space'
import type { SuggestionNotice } from '../suggestions/types'

type EditorPaneProps = {
  readonly initialDoc: string
  readonly onChange: (doc: string) => void
  readonly onNotice: (notice: SuggestionNotice) => void
  readonly onReviewStatus: (status: ReviewStatus) => void
  readonly onReviewNotice: (notice: ReviewNotice) => void
  readonly onReviewControls: (controls: ReviewControls | null) => void
  readonly getTopInset: () => number
}

export function EditorPane({
  initialDoc,
  onChange,
  onNotice,
  onReviewStatus,
  onReviewNotice,
  onReviewControls,
  getTopInset,
}: EditorPaneProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const initialDocRef = useRef(initialDoc)
  const handlersRef = useRef({
    onChange,
    onNotice,
    onReviewStatus,
    onReviewNotice,
    onReviewControls,
    getTopInset,
  })

  useEffect(() => {
    handlersRef.current = {
      onChange,
      onNotice,
      onReviewStatus,
      onReviewNotice,
      onReviewControls,
      getTopInset,
    }
  }, [
    onChange,
    onNotice,
    onReviewStatus,
    onReviewNotice,
    onReviewControls,
    getTopInset,
  ])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return undefined
    const view = createEditorView({
      parent,
      doc: initialDocRef.current,
      onChange: (doc) => handlersRef.current.onChange(doc),
      extensions: [
        spaceBelowHeader(() => handlersRef.current.getTopInset()),
        ...suggestionExtensions({
          client: createLazyModelClient(() =>
            import('../ai/browser-client').then((module) =>
              module.createBrowserModelClient(),
            ),
          ),
          onNotice: (notice) => handlersRef.current.onNotice(notice),
          review: {
            onStatus: (status) => handlersRef.current.onReviewStatus(status),
            onNotice: (notice) => handlersRef.current.onReviewNotice(notice),
            ...(import.meta.env.DEV && {
              onDrop: (drop) => appendReviewDrop(window, drop),
            }),
          },
        }),
      ],
    })
    handlersRef.current.onReviewControls(bindReviewControls(view))
    return () => {
      handlersRef.current.onReviewControls(null)
      view.destroy()
    }
  }, [])

  return <div ref={parentRef} />
}
