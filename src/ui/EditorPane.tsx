import { useEffect, useRef } from 'react'
import { appendReviewDrop } from '../ai/dev-log'
import { createLazyModelClient } from '../ai/lazy-client'
import { createEditorView } from '../editor/create-editor-view'
import {
  bindDocumentControls,
  type DocumentControls,
} from '../editor/document-controls'
import { historyEvents } from '../editor/history-events'
import {
  bindReviewControls,
  type ReviewControls,
} from '../editor/review-controls'
import type { ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import { suggestionExtensions } from '../editor/suggestions'
import { spaceBelowHeader } from '../editor/tooltip-space'
import type { HistoryEvent } from '../history/events'
import type { SuggestionNotice } from '../suggestions/types'

type EditorPaneProps = {
  readonly initialDoc: string
  readonly onChange: (doc: string) => void
  readonly onNotice: (notice: SuggestionNotice) => void
  readonly onReviewStatus: (status: ReviewStatus) => void
  readonly onReviewNotice: (notice: ReviewNotice) => void
  readonly onReviewControls: (controls: ReviewControls | null) => void
  readonly onDocumentControls: (controls: DocumentControls | null) => void
  readonly onHistoryEvent: (event: HistoryEvent) => void
  readonly getTopInset: () => number
}

export function EditorPane({
  initialDoc,
  onChange,
  onNotice,
  onReviewStatus,
  onReviewNotice,
  onReviewControls,
  onDocumentControls,
  onHistoryEvent,
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
    onDocumentControls,
    onHistoryEvent,
    getTopInset,
  })

  useEffect(() => {
    handlersRef.current = {
      onChange,
      onNotice,
      onReviewStatus,
      onReviewNotice,
      onReviewControls,
      onDocumentControls,
      onHistoryEvent,
      getTopInset,
    }
  }, [
    onChange,
    onNotice,
    onReviewStatus,
    onReviewNotice,
    onReviewControls,
    onDocumentControls,
    onHistoryEvent,
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
        historyEvents((event) => handlersRef.current.onHistoryEvent(event)),
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
    handlersRef.current.onDocumentControls(bindDocumentControls(view))
    return () => {
      handlersRef.current.onReviewControls(null)
      handlersRef.current.onDocumentControls(null)
      view.destroy()
    }
  }, [])

  return <div ref={parentRef} />
}
