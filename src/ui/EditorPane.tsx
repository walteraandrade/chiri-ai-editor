import { useEffect, useEffectEvent, useRef } from 'react'
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
  revealAfterReviewPass,
} from '../editor/review-controls'
import type { ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import { type FailureNotice, suggestionExtensions } from '../editor/suggestions'
import { spaceBelowHeader } from '../editor/tooltip-space'
import type { HistoryEvent } from '../history/events'
import type { SuggestionNotice } from '../suggestions/types'
import { whenIdle } from './idle'

type EditorPaneProps = {
  readonly initialDoc: string
  readonly onChange: (doc: string) => void
  readonly onNotice: (notice: SuggestionNotice) => void
  readonly onFailure: (notice: FailureNotice) => void
  readonly onReviewStatus: (status: ReviewStatus) => void
  readonly onReviewNotice: (notice: ReviewNotice) => void
  readonly onReviewControls: (controls: ReviewControls | null) => void
  readonly onReviewEnd: (revealed: boolean) => void
  readonly onDocumentControls: (controls: DocumentControls | null) => void
  readonly onHistoryEvent: (event: HistoryEvent) => void
  readonly getTopInset: () => number
}

export function EditorPane({
  initialDoc,
  onChange,
  onNotice,
  onFailure,
  onReviewStatus,
  onReviewNotice,
  onReviewControls,
  onReviewEnd,
  onDocumentControls,
  onHistoryEvent,
  getTopInset,
}: EditorPaneProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const initialDocRef = useRef(initialDoc)
  const emitChange = useEffectEvent(onChange)
  const emitNotice = useEffectEvent(onNotice)
  const emitFailure = useEffectEvent(onFailure)
  const emitReviewStatus = useEffectEvent(onReviewStatus)
  const emitReviewNotice = useEffectEvent(onReviewNotice)
  const emitReviewControls = useEffectEvent(onReviewControls)
  const emitReviewEnd = useEffectEvent(onReviewEnd)
  const emitDocumentControls = useEffectEvent(onDocumentControls)
  const emitHistoryEvent = useEffectEvent(onHistoryEvent)
  const topInset = useEffectEvent(getTopInset)

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return undefined
    const client = createLazyModelClient(() =>
      import('../ai/browser-client').then((module) =>
        module.createBrowserModelClient(),
      ),
    )
    const view = createEditorView({
      parent,
      doc: initialDocRef.current,
      onChange: (doc) => emitChange(doc),
      extensions: [
        spaceBelowHeader(() => topInset()),
        historyEvents((event) => emitHistoryEvent(event)),
        ...suggestionExtensions({
          client,
          onNotice: (notice) => emitNotice(notice),
          onFailure: (notice) => emitFailure(notice),
          review: {
            onStatus: (status) => emitReviewStatus(status),
            onNotice: (notice) => emitReviewNotice(notice),
            onEnd: () => emitReviewEnd(revealAfterReviewPass(view)),
            ...(import.meta.env.DEV && {
              onDrop: (drop) => appendReviewDrop(window, drop),
            }),
          },
        }),
      ],
    })
    emitReviewControls(bindReviewControls(view))
    emitDocumentControls(bindDocumentControls(view))
    const cancelPreload = whenIdle(client.preload)
    return () => {
      cancelPreload()
      emitReviewControls(null)
      emitDocumentControls(null)
      view.destroy()
    }
  }, [])

  return <div ref={parentRef} />
}
